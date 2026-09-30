import { expect, test } from "@playwright/test";
import { installCleanAppState } from "./test-setup";

test.beforeEach(async ({ page }) => { await installCleanAppState(page); });

test("PROFILE-03 explicitly saves and removes a mission independently of seeded conversation history", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/profile");
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  await expect(page.getByTestId("profile-saved-missions")).toContainText("저장된 미션이 아직 없어요.");
  await page.goto("/missions/hotel-check-in");
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  await page.getByRole("button", { name: "미션 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "미션 저장 해제", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "미션 저장 해제", exact: true })).toBeEnabled();
  await page.goto("/profile");
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  const library = page.getByTestId("profile-saved-missions");
  await expect(library.getByRole("article")).toHaveCount(1);
  await expect(library.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", "/missions/hotel-check-in");
  await library.getByRole("button", { name: "미션 저장 해제", exact: true }).click();
  await expect(library).toContainText("저장된 미션이 아직 없어요.");
  await page.reload();
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(0);
});

test("PROFILE-03 keeps the prior save state on storage failure and retries the same request", async ({ page }) => {
  await page.goto("/missions/hotel-check-in");
  await expect(page.getByRole("button", { name: "미션 저장", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "lingua-saved-missions-v1") {
        Storage.prototype.setItem = original;
        throw new Error("Saved mission quota exceeded");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "미션 저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Saved mission quota exceeded" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lingua-saved-missions-v1"))).toBeNull();
  await expect(page.getByRole("button", { name: "미션 저장 다시 시도", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "미션 저장 다시 시도", exact: true }).click();
  await expect(page.getByRole("button", { name: "미션 저장 해제", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lingua-saved-missions-v1")!).receipts.length)).toBe(1);
});

test("PROFILE-03 removes an unavailable saved mission and recovers corrupt storage without resetting it", async ({ page }) => {
  await page.goto("/profile");
  await page.evaluate(() => localStorage.setItem("lingua-saved-missions-v1", JSON.stringify({ version: 1, entries: [{ missionId: "removed-mission", savedAt: "2026-09-10T12:00:00.000Z" }], receipts: [] })));
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  const library = page.getByTestId("profile-saved-missions");
  await expect(library).toContainText("현재 볼 수 없는 미션");
  await expect(library.getByRole("link")).toHaveCount(0);
  await library.getByRole("button", { name: "미션 저장 해제", exact: true }).click();
  await expect(library).toContainText("저장된 미션이 아직 없어요.");
  const saved = await page.evaluate(() => localStorage.getItem("lingua-saved-missions-v1"));
  await page.evaluate(() => localStorage.setItem("lingua-saved-missions-v1", "corrupt"));
  await page.reload();
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "목록을 비우지 않았습니다." })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lingua-saved-missions-v1"))).toBe("corrupt");
  await page.evaluate((value) => localStorage.setItem("lingua-saved-missions-v1", value!), saved);
  await page.getByRole("button", { name: "저장 미션 다시 불러오기" }).click();
  await expect(library).toContainText("저장된 미션이 아직 없어요.");
});
