import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };

async function currentId(page: Page) {
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", /^[0-9a-f-]{36}$/);
  return (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
}
async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  return currentId(page);
}
async function userMessage(request: APIRequestContext, id: string, text: string) {
  // Persist an actual user-authored fixture through the app API. No assistant or AI response is fabricated.
  const response = await request.post(`/api/conversations/${id}/messages`, {
    headers, data: { clientMessageId: randomUUID(), parts: [{ type: "text", text }] },
  });
  expect(response.ok(), `Persist user fixture: ${response.status()}`).toBe(true);
}
async function messages(id: string) {
  const result = await adminClient().from("messages").select("id, role, plain_text").eq("conversation_id", id);
  expect(result.error).toBeNull();
  return result.data!;
}
async function command(page: Page, value: string) {
  await page.getByTestId("chat-input").fill(value);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeEnabled();
  await page.getByTestId("chat-input").press("Enter");
}

test("AI-independent rename/history/share and API revocation persist with read-only viewer isolation", async ({ page, browser, createAccount }) => {
  const id = await openChat(page);
  const phrase = `User-authored management fixture ${randomUUID()}`;
  await userMessage(page.request, id, phrase);
  await page.reload();
  await expect(page.getByTestId("message-user")).toContainText(phrase);
  const title = `Managed conversation ${randomUUID()}`;
  await page.getByRole("button", { name: "대화 관리", exact: true }).click();
  const manage = page.getByRole("dialog", { name: "대화 관리", exact: true });
  await manage.getByLabel("대화 제목").fill(title);
  await manage.getByRole("button", { name: "제목 저장" }).click();
  await expect.poll(async () => {
    const result = await adminClient().from("conversations").select("title").eq("id", id).single();
    expect(result.error).toBeNull();
    return result.data?.title;
  }).toBe(title);
  await page.goto("/history");
  await page.getByTestId("persisted-history").filter({ hasText: title }).getByRole("link", { name: "이어서 대화" }).click();
  expect(await currentId(page)).toBe(id);
  await expect(page.getByTestId("message-user")).toContainText(phrase);
  const other = await browser.newContext({ baseURL: origin });
  try {
    await signIn(other.request, await createAccount());
    expect((await other.request.get(`/api/conversations/${id}`)).status()).toBe(404);
    expect((await other.request.patch(`/api/conversations/${id}`, { headers, data: { action: "update", title: "Unauthorized rename" } })).status()).toBe(404);
    await page.getByRole("button", { name: "대화 공유", exact: true }).click();
    const href = await page.getByRole("dialog", { name: "대화 공유", exact: true }).getByRole("link", { name: "읽기 전용 화면 열기" }).getAttribute("href");
    expect(href).toMatch(/^\/shared\//);
    const viewer = await other.newPage();
    await viewer.goto(href!);
    await expect(viewer.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(viewer.getByLabel("공유된 메시지")).toContainText(phrase);
    await expect(viewer.getByRole("textbox", { name: "영어 메시지" })).toHaveCount(0);
    await viewer.reload();
    await expect(viewer.getByLabel("공유된 메시지")).toContainText(phrase);
    // There is currently no revoke button; exercise the real owner visibility endpoint explicitly.
    const revoked = await page.request.patch(`/api/conversations/${id}`, { headers, data: { action: "update", visibility: "private" } });
    expect(revoked.ok()).toBe(true);
    const stored = await adminClient().from("conversations").select("visibility, title").eq("id", id).single();
    expect(stored.error).toBeNull();
    expect(stored.data).toEqual({ visibility: "private", title });
    await viewer.reload();
    await expect(viewer.getByRole("heading", { name: "공유 대화를 찾을 수 없어요." })).toBeVisible();
    await expect(viewer.getByLabel("공유된 메시지")).toHaveCount(0);
  } finally {
    await other.request.post("/api/auth/logout", { headers });
    await other.close();
  }
});

test("AI-independent clear/delete/purge cancel and confirm only affect the owning account", async ({ page, request, account, createAccount }) => {
  const aiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/ai/")) aiRequests.push(request.url());
  });
  const first = await openChat(page);
  await userMessage(page.request, first, "User fixture for clear confirmation");
  await page.reload();
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await signIn(request, await createAccount());
  const catalog = await request.get("/api/characters");
  expect(catalog.ok()).toBe(true);
  const characterId = (await catalog.json()).items[0].id;
  const otherCreated = await request.post("/api/conversations", { headers, data: { characterId, title: "Other account stays intact" } });
  expect(otherCreated.ok()).toBe(true);
  const otherId = (await otherCreated.json()).item.id;
  await userMessage(request, otherId, "Other account user fixture");
  try {
    const denied = await request.delete(`/api/conversations/${first}/messages`, { headers, data: { confirmation: "CLEAR MESSAGES", requestId: randomUUID() } });
    expect([403, 404]).toContain(denied.status());
    const original = await messages(first);
    expect(original).toEqual([expect.objectContaining({ role: "user", plain_text: "User fixture for clear confirmation" })]);
    expect(aiRequests, "Restoring an unanswered remote user message requires explicit continuation").toEqual([]);
    await expect(page.getByRole("button", { name: "저장된 메시지 답변 이어받기", exact: true })).toBeVisible();
    await command(page, "/clear");
    const clear = page.getByRole("dialog", { name: "메시지를 초기화할까요?" });
    await clear.getByRole("button", { name: "취소", exact: true }).click();
    expect(await messages(first)).toEqual(original);
    await command(page, "/clear");
    await clear.getByRole("button", { name: "메시지 초기화 확인" }).click();
    await expect.poll(() => messages(first)).toEqual([]);
    await page.reload();
    expect(await currentId(page)).toBe(first);
    await expect(page.getByTestId("message-user")).toHaveCount(0);
    await command(page, "/new");
    await expect(page.getByTestId("chat-workspace")).not.toHaveAttribute("data-conversation-id", first);
    const second = await currentId(page);
    await command(page, "/delete");
    const deletion = page.getByRole("dialog", { name: "이 대화를 삭제할까요?" });
    await deletion.getByRole("button", { name: "취소", exact: true }).click();
    expect((await page.request.get(`/api/conversations/${second}`)).ok()).toBe(true);
    await command(page, "/delete");
    await deletion.getByRole("button", { name: "대화 삭제 확인" }).click();
    await expect.poll(async () => (await page.request.get(`/api/conversations/${second}`)).status()).toBe(404);
    await expect(page.getByTestId("chat-workspace")).not.toHaveAttribute("data-conversation-id", second);
    const third = await currentId(page);
    await command(page, "/purge");
    const purge = page.getByRole("dialog", { name: "모든 대화를 삭제할까요?" });
    const confirm = purge.getByRole("button", { name: "모든 대화 삭제 확인" });
    await expect(confirm).toBeDisabled();
    await purge.getByLabel("모든 대화 삭제 확인 문구").fill("DELETE");
    await expect(confirm).toBeDisabled();
    await purge.getByRole("button", { name: "취소", exact: true }).click();
    expect((await page.request.get(`/api/conversations/${first}`)).ok()).toBe(true);
    expect((await page.request.get(`/api/conversations/${third}`)).ok()).toBe(true);
    await command(page, "/purge");
    await purge.getByLabel("모든 대화 삭제 확인 문구").fill("DELETE ALL");
    await confirm.click();
    await expect(purge).not.toBeVisible();
    await expect(page.getByTestId("chat-workspace")).not.toHaveAttribute("data-conversation-id", third);
    const fresh = await currentId(page);
    expect([first, second, third]).not.toContain(fresh);
    const remaining = await adminClient().from("conversations").select("id").eq("owner_id", account!.id).in("id", [first, second, third]);
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual([]);
    expect(await messages(fresh)).toEqual([]);
    expect((await request.get(`/api/conversations/${otherId}`)).ok()).toBe(true);
    expect(await messages(otherId)).toEqual([expect.objectContaining({ role: "user", plain_text: "Other account user fixture" })]);
    await page.goto("/history");
    await page.reload();
    for (const id of [first, second, third]) await expect(page.locator(`[href*="conversation=${id}"]`)).toHaveCount(0);
    expect(aiRequests, "Conversation management must not request AI generation").toEqual([]);
  } finally { await request.post("/api/auth/logout", { headers }); }
});

test("REF-07/08 slash rename, model and theme commands persist without sending chat messages", async ({ page }) => {
  const id = await openChat(page);
  const input = page.getByTestId("chat-input");
  const aiRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/ai/") && request.method() === "POST") aiRequests.push(request.url()); });
  const catalogResponse = await page.request.get("/api/ai/models");
  expect(catalogResponse.ok()).toBe(true);
  const catalog = await catalogResponse.json() as { items: Array<{ id: string; capabilities: Record<string, boolean | null> }> };
  const selector = page.getByRole("combobox", { name: "AI 모델 선택", exact: true });
  await expect(selector).toBeEnabled();
  const first = await selector.inputValue();
  async function assertCapabilities(entry: (typeof catalog.items)[number]) {
    for (const [key, label] of Object.entries({ vision: "이미지", documents: "PDF", tools: "도구", reasoning: "추론" })) {
      const value = entry.capabilities[key];
      await expect(page.locator("#chat-model-capabilities").getByText(`${label}: ${value === true ? "지원" : value === false ? "미지원" : "미확인"}`, { exact: true })).toBeVisible();
    }
  }
  await assertCapabilities(catalog.items.find(item => item.id === first)!);
  const selected = catalog.items.find(item => item.id !== first)!;
  expect(selected, "Two real allowed models are needed to verify model changes").toBeTruthy();
  await command(page, "/model disallowed-regression-model");
  await expect(page.getByText("선택 가능한 모델 ID를 입력해 주세요.", { exact: true })).toBeVisible();
  await expect(selector).toHaveValue(first);
  await expect(input).toHaveValue("/model disallowed-regression-model");
  await page.getByLabel("AI 모델 검색").fill(selected.id);
  await expect(selector.locator(`option[value="${selected.id}"]`)).toHaveCount(1);
  await command(page, `/model ${selected.id}`);
  await expect(selector).toHaveValue(selected.id);
  await expect(input).toHaveValue("");
  await assertCapabilities(selected);
  const title = `Command title ${randomUUID()}`;
  await command(page, `/rename ${title}`);
  await expect(input).toHaveValue("");
  const row = async () => {
    const result = await adminClient().from("conversations").select("title,model_id").eq("id", id).single();
    expect(result.error).toBeNull(); return result.data!;
  };
  await expect.poll(row).toEqual({ title, model_id: selected.id });
  await page.reload();
  await expect(selector).toBeEnabled();
  await expect(selector).toHaveValue(selected.id);
  await assertCapabilities(selected);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  const wasDark = await page.locator("html").evaluate(element => element.classList.contains("dark"));
  const before = await page.getByTestId("app-shell").evaluate(element => getComputedStyle(element).backgroundColor);
  await command(page, "/theme");
  await expect(page.locator("html")).toHaveClass(wasDark ? /light/ : /dark/);
  await expect.poll(() => page.getByTestId("app-shell").evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(before);
  await expect(input).toHaveValue("");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(wasDark ? /light/ : /dark/);
  await command(page, "/theme");
  await expect(page.locator("html")).toHaveClass(wasDark ? /dark/ : /light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(wasDark ? /dark/ : /light/);
  expect(await row()).toEqual({ title, model_id: selected.id });
  expect(await messages(id)).toEqual([]);
  expect(aiRequests).toEqual([]);
  await page.goto("/history");
  await expect(page.getByTestId("persisted-history").filter({ hasText: title })).toBeVisible();
});
