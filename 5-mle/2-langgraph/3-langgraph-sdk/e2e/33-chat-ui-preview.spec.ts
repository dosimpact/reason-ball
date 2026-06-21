import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "chat_ui_preview";

type StreamRequestRecord = {
  body: string;
  url: string;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function collectStrings(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return [value];
  if (typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
}

async function namedPanel(page: Page, name: RegExp) {
  const region = page.getByRole("region", { name }).first();
  if ((await region.count()) > 0) return region;
  return page.locator("[class*='panel']").filter({ hasText: name }).first();
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function langGraphApiInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /api url|langgraph api url/i }).first();
}

function requestInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^UI request$/i }).first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runButton(page: Page) {
  return actionButton(page, /^Run UI preview$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

function applyButton(page: Page) {
  return actionButton(page, /^Apply preview$/i);
}

function revertButton(page: Page) {
  return actionButton(page, /^Revert preview$/i);
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: /33\s+Chat \+ UI Preview/i }).click();
  await expect(page.getByRole("heading", { name: /^(?:33\s+)?Chat \+ UI Preview$/i })).toBeVisible();
  await expect(langGraphApiInput(page)).toHaveValue(API_URL);
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(/waiting|no .* yet|run .* to .*|empty|not available/gi, ""),
  );
}

async function waitForPanelText(
  panel: Locator,
  title: RegExp,
  textOrPattern: string | RegExp,
  timeout = 60_000,
) {
  const pattern =
    typeof textOrPattern === "string" ? new RegExp(textOrPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : textOrPattern;
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).toMatch(pattern);
}

function eventCards(panel: Locator) {
  return panel.locator(".event-row, [class*='event' i], details, pre, code, article, li");
}

function watchStreamRequests(page: Page) {
  const records: StreamRequestRecord[] = [];
  const handler = (request: Request) => {
    if (request.method() !== "POST" || !request.url().includes("/runs/stream")) return;
    records.push({
      body: request.postData() ?? "",
      url: request.url(),
    });
  };

  page.on("request", handler);
  return {
    records,
    stop: () => page.off("request", handler),
  };
}

function assertStreamRequests(records: StreamRequestRecord[], marker: string, revertMarker: string) {
  expect(records.length).toBeGreaterThanOrEqual(4);
  const serialized = records
    .map((record) => `${record.url}\n${JSON.stringify(parseJson(record.body) ?? record.body)}`)
    .join("\n");
  const strings = records.flatMap((record) => collectStrings(parseJson(record.body))).join(" ");

  expect(serialized).toContain(GRAPH_ID);
  expect(strings || serialized).toMatch(/\bupdates?\b/i);
  expect(strings || serialized).toMatch(/\bcustom\b/i);
  expect(serialized).toContain(marker);
  expect(serialized).toContain(revertMarker);
  expect(strings || serialized).toMatch(/\bgenerate\b/i);
  expect(strings || serialized).toMatch(/\bapply\b/i);
  expect(strings || serialized).toMatch(/\bapprove\b/i);
  expect(strings || serialized).toMatch(/\brevert\b/i);
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(requestInput(page)).toBeVisible();
  await expect(runButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
  await expect(applyButton(page)).toBeVisible();
  await expect(revertButton(page)).toBeVisible();

  for (const name of [
    /preview status/i,
    /chat transcript/i,
    /live preview/i,
    /component code/i,
    /diff preview/i,
    /component tree/i,
    /style controls/i,
    /approval controls/i,
    /version history/i,
    /preview events/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, name)).toBeVisible();
  }
}

test("Chat + UI Preview exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Chat + UI Preview generates, applies, and reverts sandboxed UI changes", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const marker = `E2E UI preview marker ${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const revertMarker = `E2E UI revert marker ${Date.now()}`;
  await requestInput(page).fill(
    `${marker}: create a compact launch status card with success metrics, review badge, style controls, component tree, diff preview, and sandbox logs.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runButton(page).click();

  const statusPanel = await namedPanel(page, /preview status/i);
  const livePreviewPanel = await namedPanel(page, /live preview/i);
  const codePanel = await namedPanel(page, /component code/i);
  const diffPanel = await namedPanel(page, /diff preview/i);
  const treePanel = await namedPanel(page, /component tree/i);
  const stylePanel = await namedPanel(page, /style controls/i);
  const approvalPanel = await namedPanel(page, /approval controls/i);
  const historyPanel = await namedPanel(page, /version history/i);
  const previewEventsPanel = await namedPanel(page, /preview events/i);
  const finalStatePanel = await namedPanel(page, /final state/i);
  const rawEventsPanel = await namedPanel(page, /raw stream events/i);

  await waitForPanelText(statusPanel, /preview status/i, /awaiting_approval|ready|LaunchPreviewCard/i, 120_000);
  await expect(livePreviewPanel.locator("iframe.preview-frame")).toBeVisible();
  await waitForPanelText(livePreviewPanel, /live preview/i, /sandbox|compiled|ready/i);
  await waitForPanelText(codePanel, /component code/i, /LaunchPreviewCard|function|return|review/i);
  await waitForPanelText(diffPanel, /diff preview/i, /\+|LaunchPreviewCard|review badge|success/i);
  await waitForPanelText(treePanel, /component tree/i, /Card|Metric|Action|Badge/i);
  await waitForPanelText(stylePanel, /style controls/i, /theme|accent|density/i);
  await waitForPanelText(previewEventsPanel, /preview events/i, /generate|completed|preview/i);
  await waitForPanelText(finalStatePanel, /final state/i, marker);
  await expect(applyButton(page)).toBeEnabled({ timeout: 90_000 });

  await applyButton(page).click();
  await waitForPanelText(statusPanel, /preview status/i, /applied|ready|v1/i, 120_000);
  await waitForPanelText(approvalPanel, /approval controls/i, /approve|Applied preview version v1/i);
  await waitForPanelText(historyPanel, /version history/i, /v1|LaunchPreviewCard/i);
  await waitForPanelText(finalStatePanel, /final state/i, /artifact_version|approval_log|applied/i);

  await requestInput(page).fill(
    `${revertMarker}: revise the card with a more restrained accent, keep sandbox logs, then let me revert the proposal.`,
  );
  await runButton(page).click();
  await waitForPanelText(statusPanel, /preview status/i, /awaiting_approval|ready/i, 120_000);
  await expect(revertButton(page)).toBeEnabled({ timeout: 90_000 });
  await revertButton(page).click();
  await waitForPanelText(statusPanel, /preview status/i, /reverted|Preview\s+reverted/i, 120_000);
  await waitForPanelText(approvalPanel, /approval controls/i, /revert|Reverted preview proposal/i);
  await waitForPanelText(finalStatePanel, /final state/i, /reverted|preview_status|approval_log/i);

  await expect(eventCards(rawEventsPanel).first()).toBeVisible({ timeout: 60_000 });
  await expect(rawEventsPanel).toContainText(/\bupdates?\b/i);
  await expect(rawEventsPanel).toContainText(/\bcustom\b/i);
  await expect(rawEventsPanel).toContainText(/chat_ui_preview|generate|apply|revert|final/i);

  streamRequests.stop();
  assertStreamRequests(streamRequests.records, marker, revertMarker);
});
