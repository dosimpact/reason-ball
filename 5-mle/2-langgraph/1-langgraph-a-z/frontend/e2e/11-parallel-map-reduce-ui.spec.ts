import { expect, Locator, Page, test } from "@playwright/test";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function namedPanel(page: Page, name: RegExp) {
  const region = page.getByRole("region", { name }).first();
  if ((await region.count()) > 0) return region;

  const classPanel = page.locator("[class*='panel']").filter({ hasText: name }).first();
  if ((await classPanel.count()) > 0) return classPanel;

  return page
    .locator("section, article, aside, details")
    .filter({ hasText: name })
    .filter({ has: page.locator(".panel-title, h2, h3, summary") })
    .last();
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /11 Parallel\s*\/\s*Map-Reduce UI/i }).click();

  await expect(page.getByRole("heading", { name: /Parallel\s*\/\s*Map-Reduce UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function requestInput(page: Page) {
  return page
    .getByRole("textbox", { name: /topic|request|prompt|input|task/i })
    .or(page.getByPlaceholder(/topic|request|prompt|input|task/i))
    .first();
}

function sampleButtons(page: Page) {
  return page
    .getByRole("button", { name: /sample|research|summarize|compare|analyze|market|support/i })
    .filter({ hasNotText: /run|reset/i });
}

function runButton(page: Page) {
  return page
    .getByRole("button", {
      name: /run\s+(map[-\s]?reduce|parallel\s+workers|parallel|workers)/i,
    })
    .first();
}

function workerCards(workerPanel: Locator) {
  return workerPanel
    .locator(
      ".worker-card, [data-testid*='worker-card' i], [data-worker-id], article, li, details",
    )
    .filter({ hasText: /worker|item|pending|running|done|completed|failed/i });
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(/waiting|no .* yet|run .* to .*|empty/gi, ""),
  );
}

async function waitForPanelBodyText(panel: Locator, title: RegExp, timeout = 10_000) {
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).not.toBe("");
  return panelBodyText(panel, title);
}

async function reducerInputCount(panel: Locator) {
  const itemCount = await panel
    .locator(
      "li, .reducer-input, .result-item, [data-testid*='reducer-input' i], [data-worker-id]",
    )
    .filter({ hasText: /worker|item|result|summary|output|done|completed/i })
    .count();

  if (itemCount > 1) return itemCount;

  const text = normalizeText(await panel.innerText());
  const workerMentions = text.match(/\b(worker[-_\s]?[A-Za-z0-9]+|item\s*\d+)\b/gi) ?? [];
  const resultMentions = text.match(/\b(result|summary|output|partial)\b/gi) ?? [];
  return Math.max(itemCount, workerMentions.length, resultMentions.length);
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(panel).toContainText(/updates|custom/i);
  await expect(panel).toContainText(/worker/i);
  await expect(panel).toContainText(/reducer|reduce/i);
  return panel;
}

test("Parallel / Map-Reduce UI displays worker progress and reducer output", async ({ page }) => {
  await selectExample(page);

  const request = requestInput(page);
  await expect(request).toBeVisible();
  await expect(request).not.toHaveValue("");

  await expect(sampleButtons(page).first()).toBeVisible();

  await runButton(page).click();

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 30_000 });

  const workerProgress = await namedPanel(page, /worker progress/i);
  await expect(workerProgress).toBeVisible();

  const workers = workerCards(workerProgress);
  await expect.poll(async () => workers.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await expect(workers.first()).toContainText(/worker|item|id/i);
  await expect(workerProgress).toContainText(/done|completed/i);
  await expect(workerProgress).toContainText(/item|worker[-_\s]?\d+|worker id|worker_id/i);
  await expect(workerProgress).toContainText(/result|summary|output|partial/i);

  const reducerInputs = await namedPanel(page, /reducer inputs/i);
  await expect(reducerInputs).toBeVisible();
  await expect
    .poll(async () => reducerInputCount(reducerInputs), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(2);
  await expect(reducerInputs).toContainText(/worker|item|result|summary|output/i);

  const reducerOutput = await namedPanel(page, /reducer output|final summary/i);
  await expect(reducerOutput).toBeVisible();
  await waitForPanelBodyText(reducerOutput, /reducer output|final summary/i);
  await expect(reducerOutput).toContainText(/summary|final|combined|output|result/i);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelBodyText(finalState, /final state/i);
  await expect(finalState).toContainText(/worker_results|worker results|workers/i);
  await expect(finalState).toContainText(/reducer|reduce/i);
  await expect(finalState).toContainText(/final|summary|output|combined/i);

  await populatedRawEvents(page);
});
