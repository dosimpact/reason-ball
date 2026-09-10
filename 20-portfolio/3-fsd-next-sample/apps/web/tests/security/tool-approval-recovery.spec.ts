import { expect, test, type Page } from "@playwright/test";
import { seedCharacters } from "../../src/shared/api/learning/mock-data";
import { installChatBrowserStubs, installCleanAppState } from "../e2e/test-setup";

const conversationId = "56000000-0000-4000-8000-000000000001";
const assistantId = "56000000-0000-4000-8000-000000000002";
const userId = "56000000-0000-4000-8000-000000000003";
const character = seedCharacters.find((item) => item.id === "mia-hotelier")!;

// These are HTTP-client recovery fixtures, NOT live Supabase authorization tests.
// DB ownership, lease and decision integrity run separately in test:db.
async function installApprovalFixture(page: Page, approved: boolean, persisted: boolean) {
  await installCleanAppState(page);
  await installChatBrowserStubs(page);
  const input = { location: "London" };
  const approval = { id: "saved-approval", ...(persisted ? { approved } : {}) };
  const toolPart = { type: "tool-weather", toolCallId: "saved-call", state: persisted ? "approval-responded" : "approval-requested", input, approval };
  const rows = [
    { id: userId, clientMessageId: userId, role: "user", status: "complete", parts: [{ type: "text", text: "Weather in London?" }], sequenceNumber: 1, createdAt: "2026-09-10T00:00:00Z" },
    { id: assistantId, clientMessageId: null, role: "assistant", status: persisted ? "error" : "complete", parts: [toolPart] as object[], sequenceNumber: 2, createdAt: "2026-09-10T00:00:01Z" },
  ];
  const requests: Array<{ conversationId: string; messages: Array<{ id: string; role: string; parts: object[] }> }> = [];
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: userId, email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" } } }));
  await page.route("**/api/me/learning", (route) => route.fulfill({ json: { snapshot: { histories: [], favoriteCharacterIds: [], completedMissionIds: [], unlockedRewardIds: [], streak: 0, xp: 0, weeklyMinutes: 0 } } }));
  await page.route(`**/api/conversations/${conversationId}/context`, (route) => route.fulfill({ json: { context: { conversationId, character, characterAliases: [character.id], missionAliases: [] } } }));
  await page.route(`**/api/conversations/${conversationId}`, (route) => route.fulfill({ json: { item: { id: conversationId, characterId: character.id, missionId: null, title: "Approval recovery", status: "active", modelId: "gpt-5.6-terra", createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:01Z" } } }));
  await page.route(`**/api/conversations/${conversationId}/messages?*`, (route) => route.fulfill({ json: { items: rows, hasMore: false } }));
  await page.route("**/api/ai/chat", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1) {
      await route.fulfill({ status: 503, json: { error: "Temporary approval continuation failure" } });
      return;
    }
    const output = { location: "London", temperature: 20, condition: "sunny", source: "fixture" };
    const finalTool = { ...toolPart, state: approved ? "output-available" : "output-denied", approval: { id: "saved-approval", approved }, ...(approved ? { output } : {}) };
    rows[1].status = "complete";
    rows[1].parts = [finalTool, { type: "text", text: "Saved approval continuation finished." }];
    const events = [
      { type: "start", messageId: assistantId },
      approved ? { type: "tool-output-available", toolCallId: "saved-call", output } : { type: "tool-output-denied", toolCallId: "saved-call" },
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "Saved approval continuation finished." },
      { type: "text-end", id: "answer" },
      { type: "finish", finishReason: "stop" },
    ];
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n" });
  });
  return { requests, rows };
}

for (const approved of [true, false]) test(`HTTP fixture restores a ${approved ? "granted" : "denied"} checkpoint after reload and retries its continuation`, async ({ page }) => {
  const fixture = await installApprovalFixture(page, approved, true);
  await page.goto(`/chat/${character.id}?conversation=${conversationId}`);
  const resume = page.getByRole("button", { name: "저장된 메시지 답변 이어받기" });
  await expect(resume).toBeVisible();
  await page.reload();
  await expect(resume).toBeVisible();
  expect(fixture.requests).toHaveLength(0);
  await resume.click();
  await expect(page.getByTestId("chat-error")).toBeVisible();
  await page.getByTestId("chat-error").getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByTestId("message-assistant").last()).toContainText("Saved approval continuation finished.");
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-assistant")).toHaveCount(1);
  expect(fixture.requests).toHaveLength(2);
  for (const request of fixture.requests) {
    expect(request.conversationId).toBe(conversationId);
    expect(request.messages.at(-1)).toMatchObject({ id: assistantId, role: "assistant", parts: [{ state: "approval-responded", input: { location: "London" }, approval: { id: "saved-approval", approved } }] });
  }
  await page.reload();
  await expect(page.getByTestId("message-assistant").last()).toContainText("Saved approval continuation finished.");
  await expect(resume).toHaveCount(0);
  expect(fixture.requests).toHaveLength(2);
});

test("HTTP fixture retries a decision whose first request never reached storage", async ({ page }) => {
  const fixture = await installApprovalFixture(page, true, false);
  await page.goto(`/chat/${character.id}?conversation=${conversationId}`);
  await page.getByTestId("weather-tool-card").getByRole("button", { name: "허용", exact: true }).click();
  await expect(page.getByTestId("chat-error")).toBeVisible();
  expect(fixture.rows[1].parts[0]).toMatchObject({ state: "approval-requested" });
  await page.getByTestId("chat-error").getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByTestId("weather-tool-card")).toContainText("20°C");
  await expect(page.getByTestId("message-assistant")).toHaveCount(1);
  expect(fixture.requests).toHaveLength(2);
  expect(fixture.requests[1].messages.at(-1)).toMatchObject({ id: assistantId, role: "assistant", parts: [{ state: "approval-responded", approval: { id: "saved-approval", approved: true } }] });
});

test("HTTP fixture restores the checkpoint when stopped after a tool output but before completion", async ({ page }, testInfo) => {
  await installApprovalFixture(page, true, true);
  await page.addInitScript(({ assistantId }) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      if (!url.endsWith("/api/ai/chat")) return originalFetch(input, init);
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({
        start(controller) {
          const events = [
            { type: "start", messageId: assistantId },
            { type: "tool-output-available", toolCallId: "saved-call", output: { location: "London", temperature: 20, condition: "sunny", source: "fixture" } },
            { type: "text-start", id: "partial" },
            { type: "text-delta", id: "partial", delta: "An unfinished follow-up" },
          ];
          for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Stopped", "AbortError")), { once: true });
        },
      }), { headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } });
    };
  }, { assistantId });
  await page.goto(`/chat/${character.id}?conversation=${conversationId}`);
  const resume = page.getByRole("button", { name: "저장된 메시지 답변 이어받기" });
  await resume.click();
  await expect(page.getByTestId("weather-tool-card")).toContainText("20°C");
  await expect(page.getByTestId("message-assistant")).toContainText("An unfinished follow-up");
  await page.getByRole("button", { name: "답변 생성 중지" }).click();
  await expect(resume).toBeVisible();
  await expect(page.getByTestId("weather-tool-card")).not.toContainText("20°C");
  await expect(page.getByTestId("message-assistant")).not.toContainText("An unfinished follow-up");
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("approval-checkpoint-after-stop.png"), fullPage: true });
});
