import { expect, test } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

test.describe("Home and discovery", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("home exposes the primary character and mission journeys", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "외우지 말고, 캐릭터와 살아봐요.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "캐릭터 둘러보기" })).toHaveAttribute(
      "href",
      "/characters",
    );
    await expect(page.getByTestId("start-first-mission")).toHaveAttribute(
      "href",
      "/missions/hotel-check-in",
    );
    await expect(page.getByText("가입 없이 체험")).toBeVisible();
    await expect(page.getByText("원어민 음성 재생")).toBeVisible();
  });

  test("character search, level filter, and favorite persist", async ({
    page,
  }) => {
    await page.goto("/characters");

    await expect(page.getByTestId("character-card-mia-hotelier")).toBeVisible();
    await expect(page.getByTestId("character-card-leo-barista")).toBeVisible();
    await expect(page.getByTestId("character-card-noah-neighbor")).toBeVisible();

    await page.getByRole("searchbox", { name: "캐릭터 검색" }).fill("바리스타");
    await expect(page.getByTestId("character-card-leo-barista")).toBeVisible();
    await expect(page.getByTestId("character-card-mia-hotelier")).toBeHidden();
    await expect(page.getByTestId("character-card-noah-neighbor")).toBeHidden();

    await page.getByRole("searchbox", { name: "캐릭터 검색" }).fill("");
    await page.getByRole("button", { name: "입문", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "입문", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("character-card-mia-hotelier")).toBeVisible();
    await expect(page.getByTestId("character-card-leo-barista")).toBeHidden();

    await page.getByRole("button", { name: "전체", exact: true }).click();
    await page.getByRole("combobox", { name: "관심사 필터" }).selectOption("카페");
    await expect(page.getByTestId("character-card-leo-barista")).toBeVisible();
    await expect(page.getByTestId("character-card-mia-hotelier")).toBeHidden();
    await page.getByRole("combobox", { name: "관심사 필터" }).selectOption("전체");
    await page.getByRole("combobox", { name: "캐릭터 정렬" }).selectOption("new");
    await expect(page.locator('[data-testid^="character-card-"]').first()).toHaveAttribute(
      "data-testid",
      "character-card-noah-neighbor",
    );

    await page.getByRole("button", { name: "Leo 즐겨찾기 추가" }).click();
    await expect(
      page.getByRole("button", { name: "Leo 즐겨찾기 해제" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Leo 즐겨찾기 해제" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto("/");
    await expect(page.getByTestId("home-favorite-characters")).toContainText("Leo");
  });

  test("mission search and category filter lead to a mission detail", async ({
    page,
  }) => {
    await page.goto("/missions");

    const search = page.getByRole("searchbox", { name: "미션 검색" });
    await search.fill("수하물");
    await expect(page.getByTestId("mission-card-airport-luggage")).toBeVisible();
    await expect(page.getByTestId("mission-card-hotel-check-in")).toBeHidden();

    await search.fill("");
    await page.getByRole("button", { name: "여행", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "여행", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("mission-card-hotel-check-in")).toBeVisible();
    await expect(page.getByTestId("mission-card-airport-luggage")).toBeVisible();
    await expect(page.getByTestId("mission-card-coffee-order")).toBeHidden();

    await page.getByRole("button", { name: "전체", exact: true }).click();
    await page.getByRole("combobox", { name: "장소 필터" }).selectOption("London");
    await page.getByRole("combobox", { name: "난이도 필터" }).selectOption("입문");
    await page.getByRole("combobox", { name: "소요 시간 필터" }).selectOption("7");
    await page.getByRole("combobox", { name: "캐릭터 필터" }).selectOption("mia-hotelier");
    await expect(page.getByTestId("mission-card-hotel-check-in")).toBeVisible();
    await expect(page.getByTestId("mission-card-airport-luggage")).toBeHidden();

    await page
      .getByRole("link", { name: "호텔 체크인하기 미션 상세 보기" })
      .click();
    await expect(page).toHaveURL(/\/missions\/hotel-check-in$/);
    await expect(page.getByTestId("mission-detail")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "호텔 체크인하기" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("mission-detail-steps").getByText("예약자 이름 말하기"),
    ).toBeVisible();
  });
});
