import { randomUUID } from "node:crypto";
import { adminClient, expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };

test("CHAR-10 a member reports another creator while ordinary users cannot moderate or self-report", async ({ page, account, browser, createAccount }) => {
  // Real report workflow; this is not evidence of automated text/image moderation.
  const owner = await createAccount();
  const creator = await browser.newContext({ baseURL: origin });
  try {
    await signIn(creator.request, owner);
    const name = `Report fixture ${randomUUID()}`;
    const created = await creator.request.post("/api/characters", { headers, data: {
      name, role: "Practice partner", tagline: "Disposable report target", description: "A safe fictional practice partner",
      personality: ["다정함"], personaGoal: "Help learners", learningGoal: "Practice greetings", speakingStyle: "Brief English",
      relationship: "Practice partner", teachingStyle: "Gentle corrections", prohibitedInstructions: ["Never request personal data"],
      accent: "American", level: "입문", topics: ["일상"], palette: ["#ff8067", "#ffc65c"], emoji: "🌱",
      visibility: "public", publishStatus: "published",
      imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=",
    } });
    expect(created.ok(), `Create report fixture: ${created.status()}`).toBe(true);
    const id = (await created.json()).item.id;
    await page.goto(`/characters/${id}`);
    await page.getByRole("button", { name: "신고하기", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `${name} 신고`, exact: true });
    await dialog.getByRole("combobox", { name: "신고 사유", exact: true }).selectOption("unsafe-language");
    const details = `Disposable safety workflow ${randomUUID()}`;
    await dialog.getByRole("textbox", { name: "상세 내용", exact: true }).fill(details);
    const submitted = page.waitForResponse(response => new URL(response.url()).pathname === `/api/characters/${id}/report` && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "검토 요청 보내기", exact: true }).click();
    expect((await submitted).status()).toBe(200);
    await expect(dialog.getByRole("status")).toContainText("검토 요청을 접수했어요.");
    const reports = await adminClient().from("character_reports").select("id,reporter_id,reason,details,status").eq("character_id", id);
    expect(reports.error).toBeNull();
    expect(reports.data).toHaveLength(1);
    expect(reports.data![0]).toMatchObject({ reporter_id: account!.id, reason: "unsafe", details, status: "pending" });
    const reportId = reports.data![0].id;
    const replay = await page.request.post(`/api/characters/${id}/report`, { headers, data: { reason: "unsafe", details } });
    expect(replay.ok()).toBe(true);
    expect((await replay.json()).report.report_id).toBe(reportId);
    const selfReport = await creator.request.post(`/api/characters/${id}/report`, { headers, data: { reason: "unsafe", details } });
    expect(selfReport.status()).toBe(403);
    const moderation = await page.request.patch(`/api/characters/${id}/report`, { headers, data: { action: "move-to-review", reportId, resolutionNote: "A member cannot moderate" } });
    expect(moderation.status()).toBe(403);
    expect((await moderation.json()).error.code).toBe("ADMINISTRATOR_REQUIRED");
    const resource = await adminClient().from("characters").select("owner_id,status,visibility").eq("id", id).single();
    expect(resource.error).toBeNull();
    expect(resource.data).toEqual({ owner_id: owner.id, status: "published", visibility: "public" });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
  } finally {
    try { expect((await creator.request.post("/api/auth/logout", { headers })).ok()).toBe(true); }
    finally { await creator.close(); }
  }
});

test("REF-32 attachment request budget is per authenticated account and returns retry metadata", async ({ page, browser, createAccount }) => {
  // Source guarantees operation:userId key before body parsing. Malformed bodies
  // consume only this temporary account's bucket; no file/provider work occurs.
  // This does not prove daily/paid-tier quotas, distributed limits, or bot defense.
  const path = `/api/conversations/${randomUUID()}/attachments`;
  for (let count = 0; count < 30; count++) {
    const response = await page.request.post(path, { headers, data: {} });
    expect(response.status(), `Own account validation request ${count + 1}`).toBe(400);
  }
  const limited = await page.request.post(path, { headers, data: {} });
  expect(limited.status()).toBe(429);
  expect((await limited.json()).code).toBe("RATE_LIMITED");
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  expect(limited.headers()["x-ratelimit-limit"]).toBe("30");
  expect(limited.headers()["x-ratelimit-remaining"]).toBe("0");
  const other = await browser.newContext({ baseURL: origin });
  try {
    await signIn(other.request, await createAccount());
    const independent = await other.request.post(path, { headers, data: {} });
    expect(independent.status(), "A different account on the same origin/IP retains its own budget").toBe(400);
  } finally {
    try { expect((await other.request.post("/api/auth/logout", { headers })).ok()).toBe(true); }
    finally { await other.close(); }
  }
});


test("REF-32 image and speech reject unauthenticated or foreign-origin requests before generation", async ({ page, browser }) => {
  const anonymous = await browser.newContext({ baseURL: origin });
  const messageId = randomUUID();
  const requests = [
    { path: "/api/ai/image", method: "POST", data: { kind: "avatar", prompt: "A friendly fictional practice partner" } },
    { path: "/api/ai/speech", method: "POST", data: { text: "Hello there" } },
    { path: "/api/ai/speech", method: "POST", data: { text: "Hello there", messageId } },
    { path: "/api/ai/speech", method: "DELETE", data: { messageId } },
  ];
  try {
    for (const request of requests) {
      const unauthenticated = await anonymous.request.fetch(request.path, { method: request.method, headers, data: request.data });
      expect(unauthenticated.status()).toBe(401);
      expect((await unauthenticated.json()).error.code).toBe("AUTHENTICATION_REQUIRED");
      expect(unauthenticated.headers()["cache-control"]).toBe("no-store");
      expect(unauthenticated.headers()["x-request-id"]).toBeTruthy();
      const foreign = await page.request.fetch(request.path, { method: request.method, headers: { Origin: "https://foreign.invalid" }, data: request.data });
      expect(foreign.status()).toBe(403);
      expect((await foreign.json()).error.code).toBe("CROSS_SITE_REQUEST_BLOCKED");
      expect(foreign.headers()["x-ai-provider"]).toBeUndefined();
    }
  } finally { await anonymous.close(); }
});
