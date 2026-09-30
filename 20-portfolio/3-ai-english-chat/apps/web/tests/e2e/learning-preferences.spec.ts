import { expect, test } from "@playwright/test";
import { installChatBrowserStubs, installCleanAppState } from "./test-setup";

test.beforeEach(async ({ page }) => {
  await installCleanAppState(page);
  await installChatBrowserStubs(page);
  await page.goto("/profile");
  await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("tab", { name: "설정" }).click();
});

test("PROFILE-01 applies saved learning and voice preferences to the next chat, not historical autoplay", async ({ page }) => {
  await page.getByLabel("학습자 레벨").selectOption("B1");
  await page.getByLabel("학습 목표", { exact: true }).fill("호텔에서 조식 시간을 질문하기");
  await page.getByLabel("관심 상황 여행").check();
  await page.getByLabel("교정 방식").selectOption("summary");
  await page.getByLabel("기본 AI 음성").selectOption("coral");
  await page.getByLabel("기본 음성 속도").selectOption("0.75");
  const preview = page.waitForRequest((request) => request.url().endsWith("/api/ai/speech") && request.method() === "POST");
  await page.getByRole("button", { name: "AI 음성 듣기", exact: true }).click();
  expect((await preview).postDataJSON()).toMatchObject({ voice: "coral", speed: 0.75 });
  await expect(page.getByRole("button", { name: "음성 일시정지" })).toBeVisible();
  await page.getByLabel("새 표현 자동 재생").check();
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  await expect(page.getByText("학습 설정을 저장했어요.")).toBeVisible();

  const speech: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/ai/speech") && request.method() === "POST") speech.push(request.postDataJSON());
  });
  await page.goto("/chat/mia-hotelier?mission=hotel-check-in");
  const input = page.getByRole("textbox", { name: "영어 메시지" });
  await expect(input).toBeEnabled();
  expect(speech).toHaveLength(0);
  const chat = page.waitForRequest((request) => request.url().endsWith("/api/ai/chat") && request.method() === "POST");
  await input.fill("What time is breakfast?");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  expect((await chat).postDataJSON().learnerPreferences).toMatchObject({ learnerLevel: "B1", learningGoal: "호텔에서 조식 시간을 질문하기", interests: ["여행"], correctionMode: "summary" });
  await expect(page.getByRole("button", { name: "음성 일시정지" })).toBeVisible();
  expect(speech).toHaveLength(1);
  expect(speech[0]).toMatchObject({ voice: "coral", speed: 0.75 });
  await page.reload();
  await expect(page.getByTestId("message-user")).toContainText("What time is breakfast?");
  await expect(page.getByRole("button", { name: "AI 음성 듣기", exact: true }).last()).toBeEnabled();
  expect(speech).toHaveLength(1);
});

test("PROFILE-01 preserves a draft after storage failure and retries without reporting false success", async ({ page }) => {
  await page.getByLabel("표시 이름").fill("보존할 이름");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "lingua-profile-preferences-v2") {
        Storage.prototype.setItem = original;
        throw new Error("설정 저장 공간 부족");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  await expect(page.getByTestId("profile-settings").getByRole("alert")).toContainText("설정 저장 공간 부족");
  await expect(page.getByLabel("표시 이름")).toHaveValue("보존할 이름");
  await expect(page.getByText("학습 설정을 저장했어요.")).toHaveCount(0);
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  await expect(page.getByText("학습 설정을 저장했어요.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "보존할 이름의 영어 여정" })).toBeVisible();
});
