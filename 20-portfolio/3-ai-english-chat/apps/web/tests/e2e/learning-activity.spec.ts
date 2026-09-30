import { expect, test } from "@playwright/test";
import { installCleanAppState } from "./test-setup";

test.beforeEach(async ({ page }) => {
  await installCleanAppState(page);
});

test("PROFILE-02 records demo activity durably and keeps home and profile totals consistent", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-10T12:00:00Z") });
  await page.goto("/");
  const summary = page.getByTestId("home-learning-summary");
  await expect(summary).toContainText("데모 학습 기록");
  await expect(summary.getByRole("article").filter({ hasText: "최근 7일 학습" })).toContainText("42분");
  await page.goto("/chat/mia-hotelier");
  const input = page.getByRole("textbox", { name: "영어 메시지" });
  await input.fill("I am practicing without sending yet.");
  const receiptCount = () => page.evaluate(() => JSON.parse(localStorage.getItem("lingua-learning-activity-v1") ?? "{}").receipts?.length ?? 0);
  await expect.poll(receiptCount).toBe(1);
  for (let index = 1; index <= 5; index++) {
    if (index === 3) await input.press("ArrowLeft");
    await page.clock.fastForward(15_000);
    await expect.poll(receiptCount).toBe(index + 1);
  }
  await page.getByRole("link", { name: "대화 나가기", exact: true }).click();
  await expect.poll(receiptCount).toBe(7);
  await page.goto("/profile");
  await expect(page.getByTestId("learning-progress").getByRole("img", { name: "최근 7일 총 43분 학습 시간 그래프" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("learning-progress").getByRole("article").filter({ hasText: "최근 7일 학습 시간" })).toContainText("43분");
  await page.goto("/");
  await expect(summary.getByRole("article").filter({ hasText: "최근 7일 학습" })).toContainText("43분");
  await expect(summary).toContainText("7일 목표 70분");
  await expect(page.getByText("목표 60분의 70%")).toHaveCount(0);
});

test("PROFILE-02 expires the demo streak consistently in the header and profile", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-10T12:00:00Z") });
  await page.goto("/");
  await expect(page.getByTestId("header-learning-streak")).toHaveText("7일");
  await page.clock.setSystemTime(new Date("2026-09-12T12:00:00Z"));
  await page.reload();
  await expect(page.getByTestId("header-learning-streak")).toHaveText("0일");
  await page.getByTestId("header-learning-streak").click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByTestId("learning-progress").getByRole("article").filter({ hasText: "연속 학습" })).toContainText("0일");
});

test("PROFILE-02 preserves existing local activity and the draft when storage fails", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-learning-summary")).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem("lingua-learning-activity-v1"));
  await page.goto("/chat/mia-hotelier");
  await expect(page.getByRole("textbox", { name: "영어 메시지" })).toBeEnabled();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "lingua-learning-activity-v1") {
        Storage.prototype.setItem = original;
        throw new Error("Activity quota exceeded");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("textbox", { name: "영어 메시지" }).fill("Keep my draft");
  await expect(page.getByTestId("learning-activity-warning")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "영어 메시지" })).toHaveValue("Keep my draft");
  expect(await page.evaluate(() => localStorage.getItem("lingua-learning-activity-v1"))).toBe(before);
  await page.getByRole("button", { name: "학습 시간 기록 다시 시도" }).click();
  await expect(page.getByTestId("learning-activity-warning")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "영어 메시지" })).toHaveValue("Keep my draft");
});
