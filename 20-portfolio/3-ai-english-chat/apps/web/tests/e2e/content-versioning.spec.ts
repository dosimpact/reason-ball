import { expect, test, type Page } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

test.describe("Creator content version lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("prefills a character and preserves draft, published, and archived versions", async ({
    page,
  }) => {
    const originalRole = "초안 여행 영어 가이드";
    const publishedRole = "게시된 여행 영어 코치";

    await createDraftCharacter(page, originalRole);
    const characterId = page.url().match(/\/characters\/([^?]+)/)?.[1];
    expect(characterId).toBeTruthy();

    await page.goto(`/characters/${characterId}/edit`);
    await expect(page.getByRole("heading", { name: "캐릭터 새 버전 만들기" })).toBeVisible();
    await expect(page.getByTestId("character-name")).toHaveValue("Version Sophie");
    await expect(page.getByTestId("character-role")).toHaveValue(originalRole);
    await expect(page.getByTestId("character-version-history")).toContainText("현재 초안");
    await expect(page.getByTestId("character-version-1")).toContainText(`Version Sophie · ${originalRole}`);

    await page.getByTestId("character-role").fill(publishedRole);
    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(page.getByTestId("character-persona-goal")).toHaveValue(
      "여행객이 첫 영어 문장을 편하게 시작하도록 돕기",
    );
    await page.getByRole("button", { name: "게시 상태로 저장" }).click();
    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(page.getByTestId("image-generation-source")).toHaveText("현재 버전 이미지");
    await page.getByTestId("save-character").click();

    await expect(page).toHaveURL(`/characters/${characterId}/edit?saved=1`);
    await expect(page.getByTestId("character-version-history")).toContainText("현재 게시됨");
    await expect(page.getByTestId("character-version-2")).toContainText(`Version Sophie · ${publishedRole}`);
    await expect(page.getByTestId("character-version-1")).toContainText(`Version Sophie · ${originalRole}`);

    await page.getByRole("button", { name: "다음 단계" }).click();
    await page.getByRole("button", { name: "보관하기" }).click();
    await page.getByRole("button", { name: "다음 단계" }).click();
    await page.getByTestId("save-character").click();

    await expect(page.getByTestId("character-version-history")).toContainText("현재 보관됨");
    await expect(page.getByTestId("character-version-3")).toContainText(publishedRole);
    await expect(page.getByTestId("character-version-2")).toContainText(publishedRole);
    await expect(page.getByTestId("character-version-1")).toContainText(originalRole);
    await page.reload();
    await expect(page.getByTestId("character-version-3")).toContainText("보관됨");

    await page.goto("/profile");
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
    await page.getByRole("tab", { name: "내 생성물" }).click();
    const characterCard = page.getByTestId(`profile-created-character-${characterId}`);
    await expect(characterCard).toBeVisible();
    await expect(characterCard.getByRole("link", { name: "보관된 내용 확인" })).toHaveAttribute(
      "href",
      `/characters/${characterId}/edit`,
    );
  });

  test("prefills a mission and preserves draft, published, and archived versions", async ({
    page,
  }) => {
    await createDraftMission(page);
    const missionId = page.url().match(/\/missions\/([^?]+)/)?.[1];
    expect(missionId).toBeTruthy();

    await page.goto(`/missions/${missionId}/edit`);
    await expect(page.getByRole("heading", { name: "미션 새 버전 만들기" })).toBeVisible();
    await expect(page.getByTestId("mission-title")).toHaveValue("Check In at a Hotel");
    await expect(page.getByLabel("학습자 역할")).toHaveValue("Hotel guest");
    await expect(page.getByTestId("mission-version-history")).toContainText("현재 초안");
    await expect(page.getByTestId("mission-version-1")).toContainText("Check In at a Hotel");

    await page.getByTestId("mission-title").fill("Published Hotel Check-in");
    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(page.getByLabel("목표 1", { exact: true })).toHaveValue(
      "Confirm the reservation using your name",
    );
    await page.getByRole("button", { name: "다음 단계" }).click();
    await page.getByRole("button", { name: "게시 상태로 저장" }).click();
    await page.getByTestId("save-mission").click();

    await expect(page).toHaveURL(`/missions/${missionId}/edit?saved=1`);
    await expect(page.getByTestId("mission-version-history")).toContainText("현재 게시됨");
    await expect(page.getByTestId("mission-version-2")).toContainText("Published Hotel Check-in");
    await expect(page.getByTestId("mission-version-1")).toContainText("Check In at a Hotel");

    await page.getByRole("button", { name: "다음 단계" }).click();
    await page.getByRole("button", { name: "다음 단계" }).click();
    await page.getByRole("button", { name: "보관하기" }).click();
    await page.getByTestId("save-mission").click();

    await expect(page.getByTestId("mission-version-history")).toContainText("현재 보관됨");
    await expect(page.getByTestId("mission-version-3")).toContainText("Published Hotel Check-in");
    await expect(page.getByTestId("mission-version-2")).toContainText("Published Hotel Check-in");
    await expect(page.getByTestId("mission-version-1")).toContainText("Check In at a Hotel");
    await page.reload();
    await expect(page.getByTestId("mission-version-3")).toContainText("보관됨");

    await page.goto("/profile");
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
    await page.getByRole("tab", { name: "내 생성물" }).click();
    const missionCard = page.getByTestId(`profile-created-mission-${missionId}`);
    await expect(missionCard).toContainText("보관됨");
    await expect(missionCard.getByRole("link", { name: "보관된 내용 확인" })).toHaveAttribute(
      "href",
      `/missions/${missionId}/edit`,
    );
  });
});

async function createDraftCharacter(page: Page, role: string) {
  await page.goto("/characters/new");
  await page.getByTestId("character-name").fill("Version Sophie");
  await page.getByTestId("character-role").fill(role);
  await page.getByRole("button", { name: "다음 단계" }).click();
  await page
    .getByTestId("character-persona-goal")
    .fill("여행객이 첫 영어 문장을 편하게 시작하도록 돕기");
  await page
    .getByTestId("character-learning-goal")
    .fill("호텔과 공항에서 필요한 문장을 반복 연습하기");
  await page.getByRole("button", { name: "다음 단계" }).click();
  await page.getByTestId("generate-character-images").click();
  await expect(page.getByTestId("image-generation-source")).toBeVisible();
  await page.getByRole("button", { name: "AI 캐릭터 시안 1", exact: true }).click();
  await page.getByTestId("save-character").click();
  await expect(page).toHaveURL(/\/characters\/version-sophie-\d+\?created=1$/);
}

async function createDraftMission(page: Page) {
  await page.goto("/missions/new");
  await page.getByTestId("generate-mission-draft").click();
  await expect(page.getByTestId("mission-draft-source")).toBeVisible();
  await page.getByRole("button", { name: "다음 단계" }).click();
  await page.getByRole("button", { name: "다음 단계" }).click();
  await page.getByTestId("save-mission").click();
  await expect(page).toHaveURL(/\/missions\/check-in-at-a-hotel-\d+\?created=1$/);
}
