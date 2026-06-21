import { expect, Locator, Page, test } from "@playwright/test";

const branchLabels = ["Translation", "Summary", "Support", "Research"];
const branchLabelPattern = /translation|summary|support|research/i;

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
  await page.getByRole("button", { name: /09 Conditional Routing UI/i }).click();

  await expect(page.getByRole("heading", { name: /Conditional Routing UI/i })).toBeVisible();
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
  return page.getByRole("button", { name: /run conditional route/i }).first();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sampleButton(page: Page, label: string | RegExp) {
  const name =
    typeof label === "string" ?
      new RegExp(`^(use\\s+)?${escapeRegExp(label)}(\\s+sample)?$`, "i")
    : label;
  return page.getByRole("button", { name }).first();
}

function selectedBranchCard(branchMap: Locator) {
  return branchMap.locator(".branch-card.done, .branch-card.selected").first();
}

function skippedBranchCards(branchMap: Locator) {
  return branchMap.locator(".branch-card.skipped");
}

function branchLabelFromText(text: string) {
  const normalized = normalizeText(text);
  return branchLabels.find((label) => new RegExp(`\\b${label}\\b`, "i").test(normalized)) ?? "";
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText((await panel.innerText()).replace(title, ""));
}

async function waitForPanelBodyText(panel: Locator, title: RegExp, timeout = 10_000) {
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).not.toBe("");
  return panelBodyText(panel, title);
}

async function selectedBranchLabel(page: Page) {
  const branchMap = await namedPanel(page, /branch map/i);
  await expect(branchMap).toBeVisible();

  const card = selectedBranchCard(branchMap);
  await expect(card).toBeVisible({ timeout: 10_000 });

  const cardLabel = branchLabelFromText(await card.innerText());
  if (cardLabel) return cardLabel;

  const routeDecision = await namedPanel(page, /route decision/i);
  const decisionLabel = branchLabelFromText(await routeDecision.innerText());
  if (decisionLabel) return decisionLabel;

  throw new Error("Expected selected branch card or route decision to include a branch label.");
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(panel).toContainText(/conditional|route|branch|updates|values|run/i);
  return panel;
}

async function chooseDifferentSample(page: Page, currentBranch: string) {
  const candidates =
    /translation/i.test(currentBranch) ?
      ["Summary", "Research", "Support"]
    : ["Translation", "Summary", "Research", "Support"];

  for (const label of candidates) {
    const button = sampleButton(page, label);
    if ((await button.count()) > 0 && (await button.isVisible())) {
      await button.click();
      return label;
    }
  }

  throw new Error("Expected a visible alternate sample button.");
}

function expectedBranchFromSample(sampleLabel: string) {
  if (/translation/i.test(sampleLabel)) return "Translation";
  if (/summary/i.test(sampleLabel)) return "Summary";
  return "Support";
}

test("Conditional Routing UI shows selected and skipped branches across two samples", async ({
  page,
}) => {
  await selectExample(page);

  const request = requestInput(page);
  await expect(request).toBeVisible();
  await expect(request).not.toHaveValue("");

  await expect(sampleButton(page, "Translation")).toBeVisible();
  await expect(sampleButton(page, "Summary")).toBeVisible();
  await expect(sampleButton(page, /Support|Research/i)).toBeVisible();

  await runButton(page).click();

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 30_000 });

  const routeDecision = await namedPanel(page, /route decision/i);
  await expect(routeDecision).toBeVisible();
  await expect(routeDecision).toContainText(branchLabelPattern);
  await expect(routeDecision).toContainText(/reason|because|matched|intent|routed/i);

  const branchMap = await namedPanel(page, /branch map/i);
  await expect(branchMap).toBeVisible();

  const selectedCard = selectedBranchCard(branchMap);
  await expect(selectedCard).toBeVisible();
  await expect(selectedCard).toContainText(branchLabelPattern);

  const skippedCards = skippedBranchCards(branchMap);
  await expect.poll(async () => skippedCards.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(skippedCards.first()).toBeVisible();
  await expect(skippedCards.first()).toContainText(branchLabelPattern);

  const firstSelectedBranch = await selectedBranchLabel(page);

  const branchResult = await namedPanel(page, /branch result/i);
  await expect(branchResult).toBeVisible();
  await waitForPanelBodyText(branchResult, /branch result/i);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await expect(finalState).toContainText(/selected/i);
  await expect(finalState).toContainText(/skipped/i);
  await expect(finalState).toContainText(new RegExp(firstSelectedBranch, "i"));

  await populatedRawEvents(page);

  const selectedSample = await chooseDifferentSample(page, firstSelectedBranch);
  const expectedNextBranch = expectedBranchFromSample(selectedSample);
  await runButton(page).click();

  await expect
    .poll(
      async () => {
        try {
          return await selectedBranchLabel(page);
        } catch {
          return "";
        }
      },
      { timeout: 30_000 },
    )
    .toBe(expectedNextBranch);

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 30_000 });
});
