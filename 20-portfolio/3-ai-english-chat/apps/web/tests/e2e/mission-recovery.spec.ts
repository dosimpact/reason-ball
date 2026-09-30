import { expect, test, type Page } from "@playwright/test";
import { installCleanAppState } from "./test-setup";

const completeTranscript = "Hello, I'd like to check in, please. The reservation is under Minji Kim. Here is my passport. Is breakfast included?";

async function sendTurn(page: Page, text: string) {
  await page.getByRole("textbox", { name: "영어 메시지" }).fill(text);
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(page.getByTestId("message-user").last()).toContainText(text);
  await expect(page.getByText("● 대화 가능", { exact: false })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installCleanAppState(page);
});

test("preserves evaluation through failed reward saving, reload, retry, and retake", async ({ page }) => {
  // LEARN-09/10, REWARD-02, MISSION-10, NFR-04.
  let evaluations = 0;
  const completions: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/ai/evaluate") evaluations += 1;
    if (request.method() === "POST" && request.url().endsWith("/complete")) completions.push(request.postDataJSON());
  });
  await page.route("**/api/mission-runs/*/complete", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "Temporary storage outage" }),
  }), { times: 1 });

  await page.goto("/chat/mia-hotelier?mission=hotel-check-in");
  await expect(page.getByTestId("mission-evaluation-panel")).toBeVisible();
  await sendTurn(page, completeTranscript);
  await page.getByRole("button", { name: "미션 마치고 평가받기" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "보상 저장에 실패했어요" })).toBeVisible();
  await expect(page.getByTestId("mission-result-panel")).not.toContainText("보상 해금");

  await page.reload();
  await expect(page.getByTestId("mission-result-panel")).toContainText("미션을 해결했어요!");
  await page.getByRole("button", { name: "보상 저장 다시 시도" }).click();
  await expect(page.getByTestId("mission-result-panel")).toContainText("+120 XP · 보상 해금");
  expect(evaluations).toBe(1);
  expect(completions).toHaveLength(2);
  expect(completions[1]).toEqual(completions[0]);

  await page.reload();
  await expect(page.getByTestId("mission-result-panel")).toContainText("+120 XP · 보상 해금");
  const api = page.context().request;
  const before = await (await api.get("/api/mission-runs")).json();
  expect(before.runs).toHaveLength(1);
  await page.getByRole("button", { name: "새 시도로 다시 도전" }).click();
  await expect(page.getByTestId("mission-evaluation-panel")).toContainText(`시도 2 · 최고 ${before.runs[0].score}점`);
  await expect(page.getByTestId("message-user")).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.getByText("누적 1,400 XP")).toBeVisible();
  await page.goto("/missions/hotel-check-in");
  await page.getByTestId("start-mission").click();
  await expect(page).toHaveURL(/conversation=/);
  const conversationId = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", conversationId!);
});

test("continues a failed attempt and evaluates the added learner evidence", async ({ page }) => {
  // LEARN-09/10: an incomplete attempt must not trap the learner on its result.
  await page.goto("/chat/mia-hotelier?mission=hotel-check-in");
  await expect(page.getByTestId("mission-evaluation-panel")).toBeVisible();
  await sendTurn(page, "Hello.");
  await page.getByRole("button", { name: "미션 마치고 평가받기" }).click();
  await expect(page.getByTestId("mission-result-panel")).toContainText("거의 다 왔어요");
  await page.getByRole("button", { name: "대화 이어서 연습하기" }).click();
  await sendTurn(page, completeTranscript);
  await page.getByRole("button", { name: "미션 마치고 평가받기" }).click();
  await expect(page.getByTestId("mission-result-panel")).toContainText("+120 XP · 보상 해금");
  const result = await (await page.context().request.get("/api/mission-runs")).json();
  expect(result.runs).toHaveLength(1);
});

test("finishes a mission from the learning notes on a 360px screen", async ({ page }) => {
  // NFR-01, LEARN-09/10: the same completion flow must be reachable on mobile.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/chat/mia-hotelier?mission=hotel-check-in");
  await sendTurn(page, completeTranscript);
  await page.getByRole("button", { name: "학습 노트 열기" }).click();
  const notes = page.getByRole("dialog", { name: "오늘의 표현 노트" });
  await notes.getByRole("button", { name: "미션 마치고 평가받기" }).click();
  await expect(notes.getByTestId("mission-result-panel")).toContainText("+120 XP · 보상 해금");
  await notes.getByRole("button", { name: "학습 노트 닫기" }).click();
  await page.reload();
  await page.getByRole("button", { name: "학습 노트 열기" }).click();
  await expect(notes.getByTestId("mission-result-panel")).toContainText("+120 XP · 보상 해금");
});
