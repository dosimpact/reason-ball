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
  await page.getByRole("button", { name: /10 Subgraph\s*\/\s*Nested Execution UI/i }).click();

  await expect(
    page.getByRole("heading", { name: /Subgraph\s*\/\s*Nested Execution UI/i }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function requestInput(page: Page) {
  return page
    .getByRole("textbox", { name: /request|prompt|input|task/i })
    .or(page.getByPlaceholder(/request|prompt|input|task/i))
    .first();
}

function runButton(page: Page) {
  return page
    .getByRole("button", { name: /run nested graph|run nested execution|run subgraph/i })
    .first();
}

function salesReportSampleButton(page: Page) {
  return page
    .getByRole("button", { name: /sales|report/i })
    .filter({ hasText: /sales|report/i })
    .first();
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText((await panel.innerText()).replace(title, ""));
}

async function waitForPanelBodyText(panel: Locator, title: RegExp, timeout = 10_000) {
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).not.toBe("");
  return panelBodyText(panel, title);
}

function subgraphDetailCandidates(page: Page, treePanel: Locator, subgraphPanel: Locator) {
  const detailText = /subgraph|team|worker|child|nested/i;

  return treePanel
    .locator("details, [aria-expanded], button")
    .filter({ hasText: detailText })
    .or(subgraphPanel.locator("details, [aria-expanded], button").filter({ hasText: detailText }))
    .or(page.locator("details, [aria-expanded]").filter({ hasText: detailText }));
}

async function ensureExpandedSubgraphDetails(page: Page, treePanel: Locator, subgraphPanel: Locator) {
  const candidates = subgraphDetailCandidates(page, treePanel, subgraphPanel);
  await expect.poll(async () => candidates.count(), { timeout: 10_000 }).toBeGreaterThan(0);

  const firstCandidate = candidates.first();
  await expect(firstCandidate).toBeVisible();

  const expanded = await firstCandidate.getAttribute("aria-expanded");
  const detailsOpen = await firstCandidate.getAttribute("open");

  if (expanded === "false" || (expanded === null && detailsOpen === null)) {
    await firstCandidate.click();
  }

  await expect(subgraphPanel).toContainText(/subgraph|team|worker|child|nested/i);
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(panel).toContainText(/updates|metadata|path|subgraph|nested|values|run/i);
  return panel;
}

async function assertCompletedNestedRun(page: Page) {
  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 30_000 });

  const tree = await namedPanel(page, /nested execution tree/i);
  await expect(tree).toBeVisible();
  await expect(tree).toContainText(/parent|supervisor|root/i);
  await expect(tree).toContainText(/subgraph|team|worker|child|nested/i);

  const breadcrumb = await namedPanel(page, /breadcrumb/i);
  await expect(breadcrumb).toBeVisible();
  await expect(breadcrumb).toContainText(
    /supervisor.*team|team.*worker|parent.*subgraph|subgraph.*worker|parent.*child/i,
  );

  const parentState = await namedPanel(page, /parent state/i);
  await expect(parentState).toBeVisible();
  await waitForPanelBodyText(parentState, /parent state/i);
  await expect(parentState).toContainText(/parent|supervisor|request|state|final|task/i);

  const subgraphState = await namedPanel(page, /subgraph state|subgraph details/i);
  await expect(subgraphState).toBeVisible();
  await waitForPanelBodyText(subgraphState, /subgraph state|subgraph details/i);
  await expect(subgraphState).toContainText(/subgraph|team|worker|child|nested|state/i);

  await ensureExpandedSubgraphDetails(page, tree, subgraphState);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelBodyText(finalState, /final state/i);
  await expect(finalState).toContainText(/nested|trace|subgraph|parent|path|worker|team/i);

  await populatedRawEvents(page);
}

test("Subgraph / Nested Execution UI separates parent and subgraph execution state", async ({
  page,
}) => {
  await selectExample(page);

  const request = requestInput(page);
  await expect(request).toBeVisible();
  await expect(request).not.toHaveValue("");

  await expect(salesReportSampleButton(page)).toBeVisible();

  await runButton(page).click();
  await assertCompletedNestedRun(page);
});
