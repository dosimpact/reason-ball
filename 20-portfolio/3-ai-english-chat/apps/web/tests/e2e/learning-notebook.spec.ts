import { expect, test } from "@playwright/test";
import { installCleanAppState } from "./test-setup";

test.beforeEach(async ({ page }) => { await installCleanAppState(page); });

test("LEARN-12 saves expressions, words and corrections without replacing duplicates and restores the personal library", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  await expect(page.getByTestId("profile-expressions")).toContainText("저장한 표현이 없어요.");
  await page.goto("/chat/mia-hotelier");
  const saveButton = page.getByTestId("message-assistant").first().getByRole("button", { name: "복습 기록 저장", exact: true });
  const dialog = page.getByRole("dialog", { name: "복습 기록 저장", exact: true });
  await saveButton.click();
  await dialog.getByLabel("저장할 표현", { exact: true }).fill("Could I check in?");
  await dialog.getByLabel("뜻 또는 복습 메모").fill("정중하게 체크인 요청하기");
  await dialog.getByRole("button", { name: "복습 기록에 저장", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("복습 기록을 저장했어요.");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();

  await saveButton.click();
  await dialog.getByLabel("저장할 표현", { exact: true }).fill("could i check in?");
  await dialog.getByLabel("뜻 또는 복습 메모").fill("이 메모로 기존 기록을 덮어쓰지 않기");
  await dialog.getByRole("button", { name: "복습 기록에 저장", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("이미 저장한 기록");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();

  await saveButton.click();
  await dialog.getByLabel("기록 종류").selectOption("word");
  await dialog.getByLabel("저장할 표현", { exact: true }).fill("reservation");
  await dialog.getByLabel("뜻 또는 복습 메모").fill("예약");
  await dialog.getByRole("button", { name: "복습 기록에 저장", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("저장했어요");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();

  await saveButton.click();
  await dialog.getByLabel("기록 종류").selectOption("correction");
  await dialog.getByLabel("저장할 표현", { exact: true }).fill("Could I check in?");
  await dialog.getByRole("button", { name: "복습 기록에 저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("교정 전 문장");
  await dialog.getByLabel("교정 전 문장").fill("I check in?");
  await dialog.getByRole("button", { name: "복습 기록에 저장", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("저장했어요");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();

  await page.goto("/profile");
  await expect(page.getByTestId("learning-progress").getByRole("article").filter({ hasText: "저장한 표현" })).toContainText("2개");
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  const library = page.getByTestId("profile-expressions");
  await expect(library.getByRole("article")).toHaveCount(3);
  await expect(library).toContainText("정중하게 체크인 요청하기");
  await expect(library).not.toContainText("이 메모로 기존 기록을 덮어쓰지 않기");
  await library.getByLabel("복습 기록 필터").selectOption("correction");
  await expect(library.getByRole("article")).toHaveCount(1);
  await expect(library).toContainText("교정 전: I check in?");
  await page.reload();
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(3);
});

test("LEARN-12 preserves the editor after quota failure and reports corrupt library data without erasing it", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/chat/mia-hotelier");
  await page.getByTestId("message-assistant").first().getByRole("button", { name: "복습 기록 저장", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "복습 기록 저장", exact: true });
  await dialog.getByLabel("저장할 표현", { exact: true }).fill("Keep this expression");
  await dialog.getByLabel("뜻 또는 복습 메모").fill("Keep this note");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "lingua-learning-notebook-v1") {
        Storage.prototype.setItem = original;
        throw new Error("Notebook quota exceeded");
      }
      return original.call(this, key, value);
    };
  });
  await dialog.getByRole("button", { name: "복습 기록에 저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("뜻 또는 복습 메모")).toHaveValue("Keep this note");
  await expect(dialog.getByLabel("뜻 또는 복습 메모")).toBeDisabled();
  await dialog.getByRole("button", { name: "같은 내용으로 다시 저장", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("저장했어요");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.goto("/profile");
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  await expect(page.getByTestId("profile-expressions")).toContainText("Keep this note");
  const saved = await page.evaluate(() => localStorage.getItem("lingua-learning-notebook-v1"));
  await page.evaluate(() => { localStorage.setItem("lingua-learning-notebook-v1", "corrupt"); });
  await page.reload();
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "복습 기록을 불러오지 못했어요." })).toContainText("기존 기록을 지우지 않았습니다.");
  expect(await page.evaluate(() => localStorage.getItem("lingua-learning-notebook-v1"))).toBe("corrupt");
  await page.evaluate((value) => localStorage.setItem("lingua-learning-notebook-v1", value!), saved);
  await page.getByRole("button", { name: "복습 기록 다시 불러오기" }).click();
  await expect(page.getByTestId("profile-expressions")).toContainText("Keep this note");
});
