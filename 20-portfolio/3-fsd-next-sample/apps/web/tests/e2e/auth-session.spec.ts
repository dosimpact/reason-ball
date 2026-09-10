import { expect, test } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

test.describe("Guest and account session", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("links a guest to email without losing learning data and returns to guest after logout", async ({
    page,
  }) => {
    await page.goto("/characters");
    await expect(page.getByTestId("auth-session")).toContainText("게스트");

    await page.getByRole("button", { name: "Leo 즐겨찾기 추가" }).click();
    await page.getByTestId("auth-session").click();
    const dialog = page.getByRole("dialog", { name: "학습 기록을 안전하게 이어가요" });
    await dialog.getByRole("tab", { name: "가입·연결" }).click();
    await dialog.getByLabel("이메일").fill("learner@example.com");
    await dialog.getByRole("button", { name: "기록을 보존하고 연결" }).click();
    await expect(dialog.getByRole("status")).toContainText("게스트 학습 기록을 보존했습니다");
    await dialog.getByRole("button", { name: "계정 창 닫기" }).click();
    await expect(page.getByTestId("auth-session")).toContainText("learner@example.com");

    await page.reload();
    await expect(page.getByRole("button", { name: "Leo 즐겨찾기 해제" })).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("auth-session").click();
    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.getByRole("button", { name: "계정 창 닫기" }).click();
    await expect(page.getByTestId("auth-session")).toContainText("게스트");
  });
});
