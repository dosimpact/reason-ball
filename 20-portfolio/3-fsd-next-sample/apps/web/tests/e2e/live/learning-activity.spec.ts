import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { adminClient, expect, test } from "./fixtures";

// Headless Chromium keeps tabs focused here even without the CDP override.
// This single sequential case uses a real window to verify native tab blur.
test.use({ headless: false });

const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };

test("DISC-01 PROFILE-02 actual focused learning records time, stops on blur, and rejects duplicate or foreign activity", async ({ page, account, createAccount }) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  async function experience() {
    const profile = await adminClient().from("profiles").select("experience_points").eq("id", account!.id).single();
    expect(profile.error).toBeNull(); return profile.data!.experience_points as number;
  }
  async function assertHomeSummary(minutes: number, streak: number, xp: number) {
    const home = page.getByTestId("home-learning-summary");
    await expect(home).toContainText("내 계정의 학습 기록");
    await expect(home).toContainText("UTC 날짜 기준");
    for (const [label, value] of [["연속 학습", `${streak}일`], ["최근 7일 학습", `${minutes}분`], ["쌓은 경험치", `${xp.toLocaleString()} XP`]]) {
      await expect(home.getByRole("article").filter({ has: page.getByRole("heading", { name: label, exact: true }) }).locator("p").first()).toHaveText(value);
    }
    await expect(home.getByText(`개인 최고 ${streak}일`, { exact: true })).toBeVisible();
  }
  // A fresh real account must begin at its actual zero DB baseline, not demo progress.
  expect(await stats()).toEqual([]);
  const initialXp = await experience();
  expect(initialXp).toBe(0);
  await assertHomeSummary(0, 0, initialXp);
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const conversationId = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  expect(conversationId).toMatch(/^[0-9a-f-]{36}$/);
  const pulses: Array<{ request: { conversationId: string; requestId: string; active: boolean }; result: { acceptedSeconds: number; recordedAt: string } }> = [];
  page.on("response", async response => {
    if (new URL(response.url()).pathname === "/api/me/activity" && response.request().method() === "POST" && response.ok()) {
      const body = await response.json();
      pulses.push({ request: response.request().postDataJSON(), result: body.activity });
    }
  });
  async function stats() {
    const result = await adminClient().from("daily_learning_stats")
      .select("learning_date,active_seconds,active_minutes,messages_sent,missions_completed")
      .eq("user_id", account!.id).order("learning_date");
    expect(result.error).toBeNull(); return result.data!;
  }
  // Real trusted keyboard input and real 15-second server pulses; no clock mocks
  // or admin-written activity timestamps/seconds.
  await input.click();
  await input.pressSequentially("Practice draft, not a sent message.");
  await expect.poll(() => pulses.filter(pulse => pulse.request.active).length).toBeGreaterThan(0);
  for (let tick = 0; tick < 8; tick++) {
    if ((await stats()).reduce((sum, day) => sum + day.active_minutes, 0) >= 1) break;
    const observed = pulses.length;
    await input.press("ArrowLeft");
    await expect.poll(() => pulses.length, { timeout: 25_000 }).toBeGreaterThan(observed);
  }
  const active = await stats();
  expect(active.reduce((sum, day) => sum + day.active_seconds, 0)).toBeGreaterThanOrEqual(60);
  expect(active.reduce((sum, day) => sum + day.active_minutes, 0)).toBeGreaterThanOrEqual(1);
  for (const day of active) {
    expect(day.active_minutes).toBe(Math.floor(day.active_seconds / 60));
    expect(day.messages_sent).toBe(0);
    expect(day.missions_completed).toBe(0);
  }
  const stop = page.waitForResponse(response => new URL(response.url()).pathname === "/api/me/activity" && response.request().postDataJSON().active === false);
  // Playwright keeps every page focused by default. Disable that override
  // before checking native browser background state; never dispatch a fake blur.
  const focusSession = await page.context().newCDPSession(page);
  await focusSession.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  const background = await page.context().newPage();
  const backgroundFocus = await page.context().newCDPSession(background);
  try {
    await background.goto("about:blank");
    await backgroundFocus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await background.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(false);
    expect((await stop).ok()).toBe(true);
    await expect.poll(async () => {
      const clock = await adminClient().from("learning_activity_clocks").select("active").eq("user_id", account!.id).single();
      expect(clock.error).toBeNull(); return clock.data!.active;
    }).toBe(false);
    const inactive = await stats();
    // A closed activity clock cannot accrue another interval.
    const closed = await page.request.post("/api/me/activity", { headers, data: { conversationId, requestId: randomUUID(), active: false } });
    expect(closed.ok()).toBe(true);
    expect((await closed.json()).activity.acceptedSeconds).toBe(0);
    expect(await stats()).toEqual(inactive);
    const positive = pulses.find(pulse => pulse.result.acceptedSeconds > 0)!;
    expect(positive).toBeDefined();
    const replay = await page.request.post("/api/me/activity", { headers, data: positive.request });
    expect(replay.ok()).toBe(true);
    expect((await replay.json()).activity).toEqual(positive.result);
    expect(await stats()).toEqual(inactive);
    const changed = await page.request.post("/api/me/activity", { headers, data: { ...positive.request, active: !positive.request.active } });
    expect(changed.status()).toBe(409);
    expect((await changed.json()).error.code).toBe("INVALID_RESOURCE_STATE");
    const attackerAccount = await createAccount();
    const attacker = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect((await attacker.auth.signInWithPassword({ email: attackerAccount.email, password: attackerAccount.password })).error).toBeNull();
    try {
      const denied = await attacker.rpc("record_learning_activity", { _conversation_id: conversationId, _request_id: randomUUID(), _active: true });
      expect(denied.error?.code).toBe("42501");
      expect(denied.error?.message).toContain("active owned conversation required");
      for (const table of ["learning_activity_clocks", "learning_activity_receipts"]) {
        expect((await attacker.from(table).select("user_id")).error?.code).toBe("42501");
      }
      expect(await stats()).toEqual(inactive);
    } finally { await attacker.auth.signOut(); }
    await page.goto("/profile");
    const expectedMinutes = inactive.reduce((sum, day) => sum + day.active_minutes, 0);
    const summary = page.getByTestId("learning-progress");
    await expect(summary.getByRole("article").filter({ hasText: "최근 7일 학습 시간" }).locator("p").first()).toHaveText(`${expectedMinutes}분`);
    const activeDays = inactive.filter(day => day.active_seconds > 0).length;
    await expect(summary.getByRole("article").filter({ hasText: "연속 학습" }).locator("p").first()).toHaveText(`${activeDays}일`);
    await page.reload();
    await expect(summary.getByRole("article").filter({ hasText: "최근 7일 학습 시간" }).locator("p").first()).toHaveText(`${expectedMinutes}분`);
    expect(await stats()).toEqual(inactive);
    await page.goto("/");
    // Only time was accrued: no sent messages or completed missions award XP.
    expect(await experience()).toBe(initialXp);
    await assertHomeSummary(expectedMinutes, activeDays, initialXp);
    await page.reload();
    await assertHomeSummary(expectedMinutes, activeDays, await experience());
    expect(await stats()).toEqual(inactive);
  } finally {
    await focusSession.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await focusSession.detach();
    await backgroundFocus.detach();
    await background.close();
  }
});
