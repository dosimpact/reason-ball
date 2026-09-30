import { expect, test } from "@playwright/test";

import { installChatBrowserStubs, installCleanAppState } from "./test-setup";

const approvalChat =
  "/chat/mia-hotelier?mission=hotel-check-in&scenario=chat-tool-approval";

test.describe("AI SDK tool approval", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
    await installChatBrowserStubs(page);
  });

  test("executes an approved server tool and renders its typed result", async ({ page }) => {
    await page.goto(approvalChat);
    await page.getByRole("textbox", { name: "영어 메시지" }).fill("What is the weather in Seoul?");
    await page.getByRole("button", { name: "메시지 보내기" }).click();

    const toolCard = page.getByTestId("weather-tool-card").filter({ hasText: "AI SDK" });
    await expect(toolCard).toContainText("Seoul 날씨 조회");
    await toolCard.getByRole("button", { name: "허용" }).click();

    await expect(toolCard).toContainText(/°C/);
    await expect(toolCard).toContainText("mock");
    await expect(page.getByTestId("message-assistant").last()).toContainText(
      "weather tool finished",
    );
  });

  test("keeps the conversation usable when the learner denies a tool", async ({ page }) => {
    await page.goto(approvalChat);
    await page.getByRole("textbox", { name: "영어 메시지" }).fill("Check the weather for me.");
    await page.getByRole("button", { name: "메시지 보내기" }).click();

    const toolCard = page.getByTestId("weather-tool-card").filter({ hasText: "AI SDK" });
    await toolCard.getByRole("button", { name: "거부" }).click();

    await expect(toolCard).toContainText("거부했어요");
    await expect(page.getByTestId("message-assistant").last()).toContainText(
      "continue without checking the weather",
    );
  });
});
