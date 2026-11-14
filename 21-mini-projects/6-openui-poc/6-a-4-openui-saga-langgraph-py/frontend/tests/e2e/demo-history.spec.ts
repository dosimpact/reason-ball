import { test, expect } from "@playwright/test";

test("SAGA-001: chat and gallery navigation do not seed inherited shadcn histories", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/chat")) requests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message Saga" })).toBeVisible();
  await page.getByRole("link", { name: /gallery/i }).click();
  await expect(page).toHaveURL(/\/gallery/);
  await page.getByRole("link", { name: "← Saga chat" }).click();
  await expect(page.getByRole("textbox", { name: "Message Saga" })).toBeVisible();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("openui-shadcn")))).toEqual([]);
});
