import { expect, test, type Page } from "@playwright/test";
import { installChatBrowserStubs, installCleanAppState } from "./test-setup";

const formatted = [
  "## Travel lesson", "", "A **bold** and *gentle* lesson with ~~old wording~~ and `reservation`.", "",
  "- Passport", "- Booking", "", "1. Greet", "2. Ask", "", "> Speak with confidence.", "",
  "Before the table.", "", "| Phrase | Meaning |", "| --- | --- |", "| Hello | 안녕하세요 |", "",
  "After the table.", "", "```js", "console.log('hello');", "```", "",
  "Visit [lesson guide](https://example.com/lesson).", "", "Inline math: $x^2 + 1$.", "",
  "$$", "\\frac{1}{2} + \\sqrt{4}", "$$",
].join("\n");

function streamBody(text: string) {
  return [
    { type: "start", messageId: "rich-answer" },
    { type: "text-start", id: "text" },
    { type: "text-delta", id: "text", delta: text },
    { type: "text-end", id: "text" },
    { type: "finish", finishReason: "stop" },
  ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n";
}

async function sendFixture(page: Page, text: string) {
  await page.route("**/api/ai/chat", (route) => route.fulfill({
    status: 200, headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: streamBody(text),
  }));
  await page.goto("/chat/mia-hotelier?attempt=new");
  await page.getByTestId("chat-input").fill("Show me a formatted lesson.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect(page.getByText("● 대화 가능", { exact: false })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installCleanAppState(page);
  await installChatBrowserStubs(page);
});

test("REF-13 renders Markdown and math, preserves surrounding prose, copies raw text and restores it", async ({ page }) => {
  await sendFixture(page, formatted);
  const answer = page.getByTestId("message-assistant").last();
  await expect(answer.getByRole("heading", { name: "Travel lesson" })).toBeVisible();
  await expect(answer.locator("strong")).toHaveText("bold");
  await expect(answer.locator("em")).toHaveText("gentle");
  await expect(answer.locator("del")).toHaveText("old wording");
  await expect(answer.locator("li")).toHaveCount(4);
  await expect(answer.locator("blockquote")).toContainText("confidence");
  await expect(answer.getByRole("cell", { name: "안녕하세요" })).toBeVisible();
  await expect(answer.getByText("Before the table.", { exact: true })).toBeVisible();
  await expect(answer.getByText("After the table.", { exact: true })).toBeVisible();
  await expect(answer.getByLabel("코드 블록")).toContainText("console.log('hello');");
  await expect(answer.locator(".katex")).toHaveCount(2);
  await expect(answer.locator("math")).toHaveCount(2);
  await expect(answer.getByRole("link", { name: "lesson guide" })).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await answer.hover();
  await answer.getByRole("button", { name: "메시지 복사" }).click();
  expect(await page.evaluate(() => (window as typeof window & { __e2eClipboardText?: string }).__e2eClipboardText)).toBe(formatted);
  // Drop attempt=new so reload resumes the locally persisted active conversation.
  await page.goto("/chat/mia-hotelier");
  await expect(page.getByTestId("message-assistant").last().getByRole("heading", { name: "Travel lesson" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("message-assistant").last().locator(".katex")).toHaveCount(2);
});

test("REF-13 blocks raw HTML, unsafe links and implicit image or math network requests", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("tracker.invalid")) externalRequests.push(request.url()); });
  await sendFixture(page, [
    '<script>window.__richAttack = true</script>', "", '<img src="https://tracker.invalid/html" onerror="window.__richAttack=true">', "",
    "[bad](javascript:alert%281%29) [data](data:text/html,test) [relative](//tracker.invalid/link)", "",
    "![tracking pixel](https://tracker.invalid/pixel)", "",
    "$\\href{javascript:alert(1)}{unsafe}$", "", "$\\includegraphics{https://tracker.invalid/math}$", "",
    "**Still readable**",
  ].join("\n"));
  const answer = page.getByTestId("message-assistant").last();
  await expect(answer.locator("strong")).toHaveText("Still readable");
  await expect(answer.locator("script, iframe, img, a[href]")).toHaveCount(0);
  await expect(answer.getByText(/tracking pixel · 자동 로딩 안 함/)).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __richAttack?: boolean }).__richAttack)).toBeUndefined();
  expect(externalRequests).toEqual([]);
});

test("REF-13 keeps wide code, tables and math inside a 360px conversation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await sendFixture(page, formatted + "\n\n```text\n" + "long_code_".repeat(60) + "\n```\n");
  const answer = page.getByTestId("message-assistant").last();
  await expect(answer.locator(".katex")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const wideCode = answer.getByLabel("코드 블록").last();
  expect(await wideCode.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await wideCode.focus();
  await expect(wideCode).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("rich-content-mobile.png"), fullPage: true });
});

test("REF-13 renders partial streamed fences and recovers from malformed math", async ({ page }) => {
  // Browser fetch adapter supplies a real controllable ReadableStream, not a completed body.
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    const state = window as typeof window & { __appendRichText?: (text: string, finish: boolean) => void };
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      if (!url.endsWith("/api/ai/chat")) return originalFetch(input, init);
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({
        start(controller) {
          const emit = (event: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          emit({ type: "start", messageId: "streamed-rich-answer" });
          emit({ type: "text-start", id: "text" });
          state.__appendRichText = (text, finish) => {
            emit({ type: "text-delta", id: "text", delta: text });
            if (finish) {
              emit({ type: "text-end", id: "text" });
              emit({ type: "finish", finishReason: "stop" });
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            }
          };
          state.__appendRichText("## Streaming lesson\n\n```js\nconst x =", false);
        },
      }), { headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } });
    };
  });
  await page.goto("/chat/mia-hotelier?attempt=new");
  await page.getByTestId("chat-input").fill("Stream my lesson.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const answer = page.getByTestId("message-assistant").last();
  await expect(answer.getByRole("heading", { name: "Streaming lesson" })).toBeVisible();
  await expect(answer.getByLabel("코드 블록")).toContainText("const x =");
  await page.evaluate(() => {
    (window as typeof window & { __appendRichText: (text: string, finish: boolean) => void })
      .__appendRichText(" 2;\n```\n\n$\\frac{$\n\n**Recovered** with $x^2$.", true);
  });
  await expect(answer.getByLabel("코드 블록")).toContainText("const x = 2;");
  await expect(answer.locator(".katex-error")).toBeVisible();
  await expect(answer.locator("strong")).toHaveText("Recovered");
  await expect(answer.locator(".katex")).toHaveCount(1);
  await expect(page.getByText("● 대화 가능", { exact: false })).toBeVisible();
});
