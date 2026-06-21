import { expect, test } from "@playwright/test";

test("SDK connection loads assistants and streams an OpenAI-backed run", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SDK Connection" })).toBeVisible();
  await expect(page.locator("input").first()).toHaveValue("http://localhost:2931");

  await page.getByRole("button", { name: /Load assistants/i }).click();
  await expect(page.getByText(/Loaded \d+ assistant/)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: /Run and stream/i }).click();
  await expect(page.getByText("Run complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".answer-box")).toContainText(/OpenAI-backed graph/i);
  await expect(page.locator(".event-row").first()).toBeVisible();
});
