import { expect, test } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

test.describe("Character builder", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("validates goals, generates an AI image, and persists the character", async ({
    page,
  }) => {
    const characterName = "E2E Sophie";
    const personaGoal = "여행객이 낯선 도시에서도 편안함을 느끼도록 돕기";
    const learningGoal = "학습자가 호텔과 거리에서 먼저 영어 질문을 시작하도록 돕기";
    const relationship = "여행 전부터 함께 준비한 믿음직한 언어 코치";
    const teachingStyle = "대화 흐름을 지킨 뒤 한 문장씩 구체적으로 교정";

    await page.goto("/characters/new");
    await expect(page.getByTestId("character-builder")).toBeVisible();

    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "캐릭터 이름과 역할을 입력해 주세요." }),
    ).toHaveText("캐릭터 이름과 역할을 입력해 주세요.");

    await page.getByTestId("character-name").fill(characterName);
    await page.getByTestId("character-role").fill("차분한 여행 영어 가이드");
    await page
      .getByLabel("한 줄 소개")
      .fill("초보 여행자의 첫 영어 문장을 기다려 주는 친구예요.");
    await page.getByRole("button", { name: "호기심", exact: true }).click();
    await page.getByRole("button", { name: "여행", exact: true }).click();
    await page.getByRole("button", { name: "다음 단계" }).click();

    await expect(
      page.getByRole("heading", { name: "대화 방식과 목표를 정해요" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "다음 단계" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({
          hasText: "캐릭터의 존재 목적과 학습 목표를 모두 입력해 주세요.",
        }),
    ).toHaveText("캐릭터의 존재 목적과 학습 목표를 모두 입력해 주세요.");

    await page.getByTestId("character-persona-goal").fill(personaGoal);
    await page.getByTestId("character-learning-goal").fill(learningGoal);
    await page.getByTestId("character-relationship").fill(relationship);
    await page.getByTestId("character-teaching-style").fill(teachingStyle);
    await page.getByLabel("영어 억양").selectOption({ label: "British" });
    await page.getByLabel("권장 레벨").selectOption({ label: "초급" });
    await page.getByRole("button", { name: /모두에게 공개/ }).click();
    await page.getByRole("button", { name: "검토 후 게시" }).click();
    await page.getByRole("button", { name: "다음 단계" }).click();

    await page.getByTestId("save-character").click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "AI 이미지 후보를 먼저 만들어 주세요." }),
    ).toHaveText("AI 이미지 후보를 먼저 만들어 주세요.");

    await page.getByTestId("generate-character-images").click();
    await expect(page.getByTestId("image-generation-source")).toHaveText(
      "AI Route 복수 응답",
    );
    await expect(page.getByTestId("character-image-candidates")).toBeVisible();
    await expect(page.getByTestId("character-image-candidates").getByRole("button")).toHaveCount(3);
    await expect(page.getByText("AI 캐릭터 시안 1")).toBeVisible();
    await expect(page.getByTestId("character-preview")).toHaveCount(0);
    await page.getByTestId("save-character").click();
    await expect(page.getByRole("alert").filter({ hasText: "후보를 직접 선택" })).toBeVisible();
    await page.getByRole("button", { name: "AI 캐릭터 시안 2", exact: true }).click();
    await expect(page.getByTestId("character-preview")).toContainText(relationship);

    await page.getByTestId("save-character").click();
    await expect(page).toHaveURL(/\/characters\/e2e-sophie-\d+\?created=1$/);
    await expect(page.getByTestId("character-detail")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: characterName }),
    ).toBeVisible();
    await expect(page.getByText(personaGoal)).toBeVisible();
    await expect(page.getByText(learningGoal)).toBeVisible();
    await expect(page.getByText(relationship)).toBeVisible();
    await expect(page.getByText(teachingStyle)).toBeVisible();
    await expect(page.getByText("게시됨", { exact: true })).toBeVisible();

    await page.getByTestId("report-character").click();
    await expect(page.getByRole("dialog", { name: `${characterName} 신고` })).toBeVisible();
    await page.getByLabel("상세 내용").fill("교육 목적과 다른 개인정보 요청을 확인했습니다.");
    await page.getByRole("button", { name: "검토 요청 보내기" }).click();
    await expect(page.getByRole("status")).toContainText("검토 요청을 접수했어요.");
    await page.getByRole("button", { name: "확인" }).click();

    await page.getByRole("link", { name: "캐릭터 목록" }).click();
    const savedCard = page.getByTestId(/^character-card-e2e-sophie-\d+$/);
    await expect(savedCard).toBeVisible();
    await expect(savedCard.getByRole("heading", { name: characterName })).toBeVisible();

    await page.reload();
    await expect(page.getByTestId(/^character-card-e2e-sophie-\d+$/)).toBeVisible();
  });
});
