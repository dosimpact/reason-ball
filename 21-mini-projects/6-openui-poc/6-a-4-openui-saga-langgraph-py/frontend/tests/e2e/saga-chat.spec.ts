import { test, expect } from "@playwright/test";

test("SAGA-001: Python tool stream renders a Saga program", async ({ page }) => {
  test.skip(process.env.RUN_LIVE_E2E !== "1", "Real model test: set RUN_LIVE_E2E=1 with Python and frontend running.");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/chat") && response.request().method() === "POST");
  await page.getByRole("textbox", { name: "Message Saga" }).fill('Call get_stock_price for AAPL. Render SagaPage with Text containing the exact phrase "AAPL Saga demo" and the mock stock result. Use only the Saga catalog.');
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const stream = await response.text();
  expect(stream).toContain('"toolCallName":"get_stock_price"');
  expect(stream).toContain('"type":"TOOL_CALL_RESULT"');
  expect(stream).toContain('"type":"RUN_FINISHED"');
  expect(stream).not.toContain('"type":"RUN_ERROR"');
  await expect(page.locator(".saga-message-assistant").getByText(/AAPL Saga demo/).first()).toBeVisible();
  await page.screenshot({ path: "output/playwright/saga-chat.png", fullPage: true });
  expect(errors).toEqual([]);
});
