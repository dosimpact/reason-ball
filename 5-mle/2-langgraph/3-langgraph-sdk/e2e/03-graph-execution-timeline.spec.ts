import { expect, test } from "@playwright/test";

test("Graph Execution Timeline shows node updates and final state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /03 Graph Execution Timeline/i }).click();

  await expect(page.getByRole("heading", { name: "Graph Execution Timeline" })).toBeVisible();
  await page.getByRole("button", { name: /Run timeline/i }).click();

  await expect(page.getByText("Run complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".timeline-node.done")).toHaveCount(3);
  await expect(page.locator(".timeline-node").nth(0)).toContainText("prepare_topic");
  await expect(page.locator(".timeline-node").nth(0)).toContainText("done");
  await expect(page.locator(".timeline-node").nth(1)).toContainText("call_model");
  await expect(page.locator(".timeline-node").nth(1)).toContainText("done");
  await expect(page.locator(".timeline-node").nth(2)).toContainText("finalize");
  await expect(page.locator(".timeline-node").nth(2)).toContainText("done");
  await expect(page.locator(".state-panel")).toContainText("Timeline result for streaming graph updates");
  await expect(page.locator(".state-panel")).toContainText("node_updates");
  await expect(page.locator(".event-row").first()).toBeVisible();
});
