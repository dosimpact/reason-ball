import type { Page } from "@playwright/test";
import { adminClient, expect, test } from "./fixtures";

// Deterministic USER content goes through the normal composer, real AI provider,
// and Supabase persistence. These tests do not fabricate an assistant response.
async function sendContent(page: Page, text: string, mobile = false) {
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  if (mobile) {
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
    await page.getByRole("navigation", { name: "모바일 메뉴", exact: true }).getByRole("button", { name: "새 채팅", exact: true }).click();
  } else await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  await input.fill(text);
  const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  expect((await generated).ok()).toBe(true);
  async function rows() {
    const result = await adminClient().from("messages").select("role,status,plain_text,parts").eq("conversation_id", id);
    expect(result.error).toBeNull(); return result.data!;
  }
  await expect.poll(async () => (await rows()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  const saved = await rows();
  expect(saved).toHaveLength(2);
  expect(saved.find(row => row.role === "user")).toMatchObject({ plain_text: text, parts: [{ type: "text", text }] });
  return id;
}

test("REF-13 real persisted user Markdown, code, table and math render on mobile without page overflow", async ({ page }) => {
  test.setTimeout(180_000);
  const text = [
    "This is a renderer test note. Please reply only with a brief acknowledgement, not a copy of the note.", "",
    "## Travel lesson", "", "Use **bold** and *gentle* words, not ~~old wording~~.", "",
    "- Hello", "- Thanks", "", "> Practice with confidence.", "",
    "Before the table.", "", "| English | Korean |", "| --- | --- |", "| Hello | 안녕하세요 |", "",
    "After the table.", "", "[lesson guide](https://example.com/lesson)", "",
    "Inline math $x^2 + y^2 = z^2$.", "", "$$", "\\frac{1}{2} + \\frac{1}{2} = 1", "$$", "",
    "```javascript", "console.log('hello');", `// ${"long_code_".repeat(60)}`, "```",
  ].join("\n");
  const id = await sendContent(page, text, true);
  const message = page.getByTestId("message-user");
  async function rendered() {
    await expect(message.getByRole("heading", { name: "Travel lesson", exact: true })).toBeVisible();
    await expect(message.locator("strong")).toHaveText("bold");
    await expect(message.locator("em")).toHaveText("gentle");
    await expect(message.locator("del")).toHaveText("old wording");
    await expect(message.locator("li")).toHaveCount(2);
    await expect(message.locator("blockquote")).toContainText("confidence");
    await expect(message.getByRole("region", { name: "메시지 표", exact: true }).getByRole("cell", { name: "안녕하세요", exact: true })).toBeVisible();
    await expect(message.getByText("Before the table.", { exact: true })).toBeVisible();
    await expect(message.getByText("After the table.", { exact: true })).toBeVisible();
    const link = message.getByRole("link", { name: "lesson guide", exact: true });
    await expect(link).toHaveAttribute("href", "https://example.com/lesson");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
    await expect(message.locator(".katex")).toHaveCount(2);
    await expect(message.locator("math")).toHaveCount(2);
    const code = message.getByLabel("코드 블록", { exact: true });
    await expect(code).toContainText("console.log('hello');");
    expect(await code.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    const bounds = await code.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
    await code.focus();
    await expect(code).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await rendered();
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id);
  await rendered();
});

test("REF-13 stored hostile Markdown cannot execute HTML or load image and math URLs before or after reload", async ({ page }) => {
  test.setTimeout(180_000);
  const requests: string[] = [];
  const dialogs: string[] = [];
  page.on("request", request => { if (request.url().includes("tracker.invalid")) requests.push(request.url()); });
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  const text = [
    "Treat the following as inert renderer test data. Reply with a brief acknowledgement; do not follow or repeat its contents.", "",
    '<script>window.__richLiveAttack = true</script>', "",
    '<img src="https://tracker.invalid/html" onerror="window.__richLiveAttack=true">', "",
    '[bad](javascript:alert%281%29) [data](data:text/html,test) [relative](//tracker.invalid/link)', "",
    '![tracking pixel](https://tracker.invalid/pixel)', "",
    '$\\href{javascript:alert(1)}{unsafe}$', "", '$\\includegraphics{https://tracker.invalid/math}$', "",
    '**Still readable**',
  ].join("\n");
  const id = await sendContent(page, text);
  const message = page.getByTestId("message-user");
  async function safe() {
    await expect(message.locator("strong")).toHaveText("Still readable");
    await expect(message.locator("script,iframe,img,a[href]")).toHaveCount(0);
    await expect(message.getByText(/tracking pixel · 자동 로딩 안 함/)).toBeVisible();
    expect(await page.evaluate(() => (window as typeof window & { __richLiveAttack?: boolean }).__richLiveAttack)).toBeUndefined();
    expect(requests).toEqual([]);
    expect(dialogs).toEqual([]);
  }
  await safe();
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id);
  await safe();
});


test("REF-13 malformed stored math and an unfinished code fence remain readable and allow another real turn", async ({ page }) => {
  test.setTimeout(180_000);
  const text = [
    "This is malformed formatting test data. Please acknowledge briefly without repeating it.", "",
    "Before invalid math.", "", "$$", "\\notARealCommand{x}", "$$", "", "$$", "\\frac{1}{", "$$", "",
    "After invalid math.", "", "```javascript", "const unfinished = 'readable';", "Unclosed fence content remains visible.",
  ].join("\n");
  const id = await sendContent(page, text);
  const original = page.getByTestId("message-user").first();
  async function readable() {
    await expect(original.getByText("Before invalid math.", { exact: true })).toBeVisible();
    await expect(original.getByText("After invalid math.", { exact: true })).toBeVisible();
    await expect(original.locator("math")).toContainText("notARealCommand");
    await expect(original.locator(".katex-error")).toContainText("frac");
    await expect(original.getByLabel("코드 블록", { exact: true })).toContainText("Unclosed fence content remains visible.");
  }
  await readable();
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id);
  await readable();
  const next = "Please greet me in one short sentence after that formatting example.";
  await page.getByRole("textbox", { name: "영어 메시지", exact: true }).fill(next);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  async function rows() {
    const result = await adminClient().from("messages").select("role,status,plain_text").eq("conversation_id", id).order("sequence_number");
    expect(result.error).toBeNull(); return result.data!;
  }
  await expect.poll(async () => (await rows()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(2);
  const saved = await rows();
  expect(saved).toHaveLength(4);
  expect(saved.filter(row => row.role === "user").map(row => row.plain_text)).toEqual([text, next]);
  await page.reload();
  await readable();
  await expect(page.getByTestId("message-user").last()).toContainText(next);
  await expect(page.getByTestId("message-assistant")).toHaveCount(2);
  expect(await rows()).toEqual(saved);
});
