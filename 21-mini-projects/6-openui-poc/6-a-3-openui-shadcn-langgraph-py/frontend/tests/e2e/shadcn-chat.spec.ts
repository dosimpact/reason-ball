import { test, expect } from "@playwright/test";

test("SHADCN-001: Python tool stream renders interactive shadcn tabs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "매출", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page.getByRole("button", { name: "Startup dashboard", exact: true })).toBeVisible();
  const responsePromise = page.waitForResponse(r => r.url().endsWith("/api/chat") && r.request().method() === "POST");
  await page.getByRole("textbox", { name: "Ask anything..." }).fill(
    'Call get_stock_price for AAPL. Render a Card with Heading "AAPL demo", TextContent noting mock data, and Tabs with exactly two TabItem triggers "Overview" and "Details". Overview contains TextContent "Summary panel". Details contains TextContent "Detail panel" and a Table of the returned stock data. Add FollowUpBlock with a follow-up question.'
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const stream = await response.text();
  expect(stream).toContain('"toolCallName":"get_stock_price"');
  expect(stream).toContain('"type":"TOOL_CALL_RESULT"');
  expect(stream).toContain('"type":"RUN_FINISHED"');
  expect(stream).not.toContain('"type":"RUN_ERROR"');
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Details", exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Details", exact: true }).getByRole("table")).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Overview", exact: true })).toBeVisible();
  await page.screenshot({ path: "output/playwright/shadcn-chat.png", fullPage: true });
  expect(errors).toEqual([]);
});
