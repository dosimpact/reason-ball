import { expect, test } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

test.describe("Mission builder", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("uses AI routes for a structured draft and reward before saving", async ({
    page,
  }) => {
    await page.goto("/missions/new");
    await expect(page.getByTestId("mission-builder")).toBeVisible();

    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "AI 초안을 만들거나 미션 제목을 입력해 주세요." }),
    ).toHaveText("AI 초안을 만들거나 미션 제목을 입력해 주세요.");

    await page
      .getByTestId("mission-prompt")
      .fill("해외 호텔에서 예약을 확인하고 조식 시간을 묻기");
    await page.getByTestId("generate-mission-draft").click();
    await expect(page.getByTestId("mission-draft-source")).toHaveText(
      "AI Route 응답",
    );
    await expect(page.getByTestId("mission-title")).toHaveValue(
      "Check In at a Hotel",
    );

    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(
      page.getByRole("heading", { name: "성공 조건과 표현을 다듬어요" }),
    ).toBeVisible();
    await expect(page.getByLabel("목표 1", { exact: true })).toHaveValue(
      "Confirm the reservation using your name",
    );
    await expect(page.getByLabel("목표 2", { exact: true })).toBeVisible();
    await expect(page.getByLabel("영어 표현 1")).toHaveValue(
      "I have a reservation under Kim.",
    );
    await expect(page.getByLabel("영어 표현 3")).toBeVisible();
    await expect(page.getByTestId("mission-steps")).toBeVisible();
    await expect(page.getByLabel("단계 1", { exact: true })).toHaveValue(
      "Confirm the reservation using your name",
    );
    await page.getByRole("button", { name: "단계 1 아래로" }).click();
    await expect(page.getByLabel("단계 1", { exact: true })).not.toHaveValue(
      "Confirm the reservation using your name",
    );
    await expect(page.getByLabel("예시 대화 2")).toHaveValue(
      "I have a reservation under Kim.",
    );

    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(
      page.getByRole("heading", { name: "완주 보상을 선택해요" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/missions\/new$/);
    await expect(page.getByTestId("reward-candidates")).toBeVisible();
    const generateRewardImage = page.getByTestId("generate-reward-image");
    await expect(generateRewardImage).toBeEnabled();
    await generateRewardImage.click();
    await expect(page.getByTestId("reward-image-source")).toHaveText(
      "AI Route 응답",
    );
    await expect(page.getByTestId("reward-image-candidate")).toBeVisible();

    await page.getByLabel("보상 이름").fill("E2E 호텔 회화 기념 장면");
    await page.getByLabel("통과 점수").fill("80");
    await page.getByLabel("선수 미션").selectOption("hotel-check-in");
    await page.getByRole("button", { name: "검토 후 게시" }).click();
    await expect(page.getByTestId("mission-validation-summary")).toContainText(
      "통과 기준 80점",
    );
    const saveMission = page.getByTestId("save-mission");
    await expect(saveMission).toBeEnabled();
    await saveMission.click();
    await expect(page).toHaveURL(
      /\/missions\/check-in-at-a-hotel-\d+\?created=1$/,
    );
    await expect(page.getByTestId("mission-detail")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Check In at a Hotel" }),
    ).toBeVisible();
    await expect(page.getByText("Confirm the reservation using your name").first()).toBeVisible();
    await expect(page.getByText("I have a reservation under Kim.").first()).toBeVisible();
    await expect(page.getByText("E2E 호텔 회화 기념 장면")).toBeVisible();
    await expect(page.getByTestId("mission-detail-steps")).toBeVisible();
    await expect(page.getByText("필수 단계 + 80점 이상이면 완료")).toBeVisible();
    await expect(page.getByText("선수 미션 · hotel-check-in")).toBeVisible();
    await expect(page.getByTestId("mission-prerequisite-gate")).toContainText(
      "선수 미션을 먼저 완료해 주세요",
    );

    await page.reload();
    await expect(page.getByTestId("mission-detail")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Check In at a Hotel" }),
    ).toBeVisible();
  });

  test("validates ordered manual steps and beginner sentence length", async ({ page }) => {
    await page.goto("/missions/new");
    await page.getByTestId("mission-title").fill("공항에서 택시 타기");
    await page.getByRole("button", { name: "다음 단계" }).click();

    await page.getByRole("button", { name: "목표 추가" }).click();
    await page.getByLabel("목표 1", { exact: true }).fill("목적지 말하기");
    await page.getByLabel("목표 1 힌트").fill("I'd like to go to...");
    await page.getByRole("button", { name: "단계 추가" }).click();
    await page.getByLabel("단계 1", { exact: true }).fill("기사에게 목적지를 말한다");
    await page.getByLabel("단계 1 성공 조건").fill("목적지 이름을 영어로 전달");
    await page.getByRole("button", { name: "표현 추가" }).click();
    await page.getByLabel("영어 표현 1").fill(
      "Could you please take me all the way to the airport terminal now",
    );
    await page.getByLabel("표현 1 뜻").fill("공항 터미널까지 데려다주세요.");

    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "10단어 이하" })).toContainText("10단어 이하");
    await page.getByLabel("영어 표현 1").fill("Please take me to the airport terminal.");
    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(page.getByRole("heading", { name: "완주 보상을 선택해요" })).toBeVisible();
  });
});
