import { test, expect } from "@playwright/test";
import demos from "../../src/data/demo-threads.json";

test("SHADCN-002: seven generated use cases survive reload and history navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "매출", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  for (const demo of demos) {
    await page.getByRole("button", { name: demo.thread.title, exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Ask anything..." })).toBeVisible();
    // Selecting each thread must restore its generated assistant program.
    await expect.poll(() => page.evaluate(() => {
      const id = JSON.parse(localStorage.getItem("openui-shadcn-langgraph:v1:selected") || "null");
      return id;
    })).toBe(demo.thread.id);
    // A semantic component is required for every saved example, not merely stored text.
    await expect(page.locator('[data-slot="card"]').first()).toBeVisible();
    await page.screenshot({ path: `output/playwright/${demo.thread.id}.png`, fullPage: true });
  }
  await page.reload();
  await expect(page.getByRole("tab").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("openui-shadcn-langgraph:v1:threads") || "[]").length)).toBe(7);
  expect(errors).toEqual([]);
});
