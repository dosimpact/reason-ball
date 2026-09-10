import { expect, test } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

test.describe("Mobile navigation", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("moves from home to characters, missions, and profile on Pixel", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "외우지 말고, 캐릭터와 살아봐요.",
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const mobileMenu = page.getByRole("navigation", { name: "모바일 메뉴" });
    await expect(mobileMenu).toBeVisible();
    await mobileMenu.getByRole("link", { name: "캐릭터" }).click();
    await expect(page).toHaveURL(/\/characters$/);
    await expect(mobileMenu).toBeHidden();
    await expect(
      page.getByRole("heading", { level: 1, name: "나와 잘 맞는 대화 상대" }),
    ).toBeVisible();

    const bottomNavigation = page.getByRole("navigation", { name: "하단 메뉴" });
    await expect(bottomNavigation).toBeVisible();
    await expect(
      bottomNavigation.getByRole("link", { name: "캐릭터" }),
    ).toHaveAttribute("aria-current", "page");

    await bottomNavigation.getByRole("link", { name: "미션" }).click();
    await expect(page).toHaveURL(/\/missions$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "오늘의 영어를 내일 바로 써요",
      }),
    ).toBeVisible();
    await expect(
      bottomNavigation.getByRole("link", { name: "미션" }),
    ).toHaveAttribute("aria-current", "page");

    await bottomNavigation.getByRole("link", { name: "프로필" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "민지의 영어 여정" }),
    ).toBeVisible();
    await expect(
      bottomNavigation.getByRole("link", { name: "프로필" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
