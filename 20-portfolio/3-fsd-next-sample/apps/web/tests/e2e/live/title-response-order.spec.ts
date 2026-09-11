import type { Route } from "@playwright/test";
import { adminClient, expect, test } from "./fixtures";

test("REF-17 delayed real pre-retry title response cannot overwrite the newer automatic title", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByTestId("chat-input");
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  async function stored() {
    const result = await adminClient().from("conversations").select("title,title_source").eq("id", id).single();
    expect(result.error).toBeNull(); return result.data!;
  }
  async function messages() {
    const result = await adminClient().from("messages").select("id,role,status,plain_text").eq("conversation_id", id).order("sequence_number");
    expect(result.error).toBeNull(); return result.data!;
  }
  const pending = await stored();
  expect(pending.title_source).toBe("pending");
  let outgoing = 0;
  let held = false;
  let fetched = false;
  let delivered = false;
  let staleTitle: unknown;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const titlePattern = `**/api/conversations/${id}`;
  const titleRoute = async (route: Route) => {
    if (route.request().method() !== "GET" || outgoing !== 1 || held) { await route.continue(); return; }
    held = true;
    const response = await route.fetch();
    try {
      expect(response.ok()).toBe(true);
      staleTitle = (await response.json()).item.title;
      fetched = true;
      await gate;
      // Replay the exact actual GET response; no fabricated title or successful AI response.
      await route.fulfill({ response });
      delivered = true;
    } finally { await response.dispose(); }
  };
  const aiRoute = async (route: Route) => {
    outgoing++;
    if (outgoing === 1) await route.abort("connectionreset");
    else await route.continue();
  };
  await page.route(titlePattern, titleRoute);
  await page.route("**/api/ai/chat", aiRoute);
  try {
    const prompt = "Please teach me one short polite greeting for a hotel guest.";
    await input.fill(prompt);
    await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    await expect(page.getByTestId("chat-error")).toBeVisible();
    await expect.poll(() => fetched).toBe(true);
    expect(staleTitle).toBe(pending.title);
    expect(await messages()).toEqual([]);
    expect(await stored()).toEqual(pending);
    const draft = "Keep this separate unsent question.";
    await input.fill(draft);
    await page.getByTestId("chat-error").getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect.poll(async () => (await messages()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
    await expect(page.getByTestId("conversation-title")).toHaveText(prompt);
    expect(await stored()).toEqual({ title: prompt, title_source: "auto" });
    expect(outgoing).toBe(2);
    const saved = await messages();
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({ role: "user", plain_text: prompt });
    const finished = page.waitForEvent("requestfinished", request => request.method() === "GET" && new URL(request.url()).pathname === `/api/conversations/${id}`);
    release();
    await finished;
    await expect.poll(() => delivered).toBe(true);
    // Drain rendering after the released response is consumed, rather than asserting before fetch settles.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByTestId("conversation-title")).toHaveText(prompt);
    await expect(input).toHaveValue(draft);
    expect(await stored()).toEqual({ title: prompt, title_source: "auto" });
    expect(await messages()).toEqual(saved);
    await page.reload();
    await expect(page.getByTestId("conversation-title")).toHaveText(prompt);
    await expect(input).toHaveValue(draft);
    expect(await messages()).toEqual(saved);
  } finally {
    release();
    await page.unroute(titlePattern, titleRoute);
    await page.unroute("**/api/ai/chat", aiRoute);
  }
});
