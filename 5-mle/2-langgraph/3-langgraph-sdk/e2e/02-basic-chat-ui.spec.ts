import { expect, test } from "@playwright/test";

test("Basic Chat UI preserves context in one LangGraph thread", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /02 Basic Chat UI/i }).click();

  await expect(page.getByRole("heading", { name: "Basic Chat UI" })).toBeVisible();
  await page.getByPlaceholder("Type a message for the same LangGraph thread").fill("My project code is cobalt.");
  await page.getByRole("button", { name: /Send/i }).click();
  await expect(page.getByText("Run complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".message-bubble.human")).toContainText("cobalt");

  await page
    .getByPlaceholder("Type a message for the same LangGraph thread")
    .fill("What project code did I give you? Answer with just the code.");
  await page.getByRole("button", { name: /Send/i }).click();
  await expect(page.getByText("Run complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".message-bubble.ai").last()).toContainText(/cobalt/i, { timeout: 10_000 });

  await page.getByRole("button", { name: /Reload state/i }).click();
  await expect(page.getByText("Conversation loaded")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".message-bubble")).toHaveCount(4);
});
