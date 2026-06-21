import { expect, test } from "@playwright/test";

const MODEL_BUTTON_REGEX = /Gemini|Claude|GPT|Grok/i;

test.describe("Parser-backed Chat Input", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("does not display a model selector", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();

    await expect(modelButton).not.toBeVisible();
  });

  test("shows filing-specific placeholder text", async ({ page }) => {
    await expect(
      page.getByPlaceholder("Ask about a 10-K filing...")
    ).toBeVisible();
  });
});
