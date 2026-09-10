import { expect, test } from "@playwright/test";

import {
  installChatBrowserStubs,
  installCleanAppState,
} from "./test-setup";

test.describe("Mission chat", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
    await installChatBrowserStubs(page);
  });

  test("streams, reacts, speaks, shares, completes, and unlocks a reward", async ({
    page,
  }) => {
    await page.goto("/missions/hotel-check-in");
    await page.getByTestId("start-mission").click();
    await expect(page).toHaveURL(
      /\/chat\/mia-hotelier\?mission=hotel-check-in(?:&(?:attempt=new|conversation=[^&]+))?$/,
    );
    await expect(page.getByTestId("chat-workspace")).toBeVisible();

    const modelSelect = page.getByLabel("AI 모델 선택");
    await expect(modelSelect).toHaveValue("gpt-5.6-terra");
    await modelSelect.selectOption("gpt-5-mini");
    await expect(modelSelect).toHaveValue("gpt-5-mini");

    await page
      .getByRole("textbox", { name: "영어 메시지" })
      .fill("I'd like to check in, please.");
    const chatRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/ai/chat",
    );
    await page.getByRole("button", { name: "메시지 보내기" }).click();
    const chatRequest = await chatRequestPromise;
    expect(chatRequest.postDataJSON()).toMatchObject({ modelId: "gpt-5-mini" });
    await expect(page.getByTestId("message-user")).toContainText(
      "I'd like to check in, please.",
    );
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    for (const text of [
      "The reservation is under Minji Kim, and here is my passport.",
      "Is breakfast included, please?",
    ]) {
      await page.getByRole("textbox", { name: "영어 메시지" }).fill(text);
      await page.getByRole("button", { name: "메시지 보내기" }).click();
      await expect(page.getByTestId("message-user").last()).toContainText(text);
    }
    await expect(page.getByTestId("message-assistant")).toHaveCount(4);
    const latestAssistant = page.getByTestId("message-assistant").last();
    await expect(latestAssistant).toContainText("English conversation partner");
    await expect(page.getByText(/AI Route/)).toBeVisible();

    await latestAssistant.hover();
    const likeButton = latestAssistant.getByRole("button", { name: "좋아요" });
    await likeButton.click();
    await expect(likeButton).toHaveAttribute("aria-pressed", "true");

    await latestAssistant.getByRole("button", { name: "메시지 복사" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as typeof window & {
                __e2eClipboardText?: string;
              }
            ).__e2eClipboardText,
        ),
      )
      .toContain("English conversation partner");

    await page.getByRole("button", { name: "대화 공유" }).click();
    const shareDialog = page.getByRole("dialog", { name: "대화 공유" });
    await expect(shareDialog).toBeVisible();
    await expect(shareDialog).toContainText("lingua.local/shared/mia-hotelier");
    await shareDialog.getByRole("button", { name: "공유 창 닫기" }).click();

    await latestAssistant.getByRole("button", { name: "AI 음성 듣기" }).click();
    await expect(latestAssistant.getByText("AI로 생성된 음성입니다.")).toBeVisible();

    const evaluationPanel = page.getByTestId("mission-evaluation-panel");
    // Synchronize with the complete evaluation/reward round trip, not a 5s DOM-only window.
    const completionResponse = page.waitForResponse((response) =>
      response.request().method() === "POST" && /\/api\/mission-runs\/[^/]+\/complete$/.test(new URL(response.url()).pathname),
    );
    await evaluationPanel.getByRole("button", { name: "미션 마치고 평가받기" }).click();
    const completed = await completionResponse;
    expect(completed.status()).toBe(200);
    await completed.finished();
    const missionResult = page.getByTestId("mission-result-panel");
    await expect(missionResult).toContainText("미션을 해결했어요!");
    await expect(missionResult).toContainText("+120 XP · 보상 해금");
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/profile$/);
    await page.reload();
    await expect(page.getByText("누적 1,400 XP")).toBeVisible();
    // Completing a mission does not manufacture its estimated seven minutes.
    await expect(page.getByRole("article").filter({ hasText: "최근 7일 학습 시간" })).toContainText("42분");
    await expect(
      page.getByRole("article").filter({ hasText: "완료한 미션" }),
    ).toContainText("1개");
    await page.getByRole("tab", { name: "보상 컬렉션" }).click();
    const unlockedReward = page.getByTestId("reward-hotel-check-in");
    await expect(unlockedReward).toContainText("해금됨");
    await expect(unlockedReward).toContainText("Mia의 런던 야경");
  });
});
