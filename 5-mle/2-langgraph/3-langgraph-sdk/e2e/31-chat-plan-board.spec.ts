import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "chat_plan_board";

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

function goalInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^Goal$/i }).first();
}

function revisionInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^Revision note$/i }).first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runButton(page: Page) {
  return actionButton(page, /^Run plan board$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

function continueButton(page: Page) {
  return actionButton(page, /^Continue execution$/i);
}

function replanButton(page: Page) {
  return actionButton(page, /^Replan board$/i);
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: /31\s+Chat \+ Plan Board/i }).click();
  await expect(page.getByRole("heading", { name: /^(?:31\s+)?Chat \+ Plan Board$/i })).toBeVisible();
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

function boardColumn(panel: Locator, status: string) {
  return panel.locator(`.plan-board-column.${status}`).first();
}

function boardCard(panel: Locator, text: RegExp) {
  return panel.locator(".plan-board-card").filter({ hasText: text }).first();
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

function assertStreamRequests(records: StreamRequestRecord[], marker: string, revisionMarker: string) {
  expect(records.length).toBeGreaterThanOrEqual(3);
  const serialized = records
    .map((record) => `${record.url}\n${JSON.stringify(parseJson(record.body) ?? record.body)}`)
    .join("\n");
  const strings = records.flatMap((record) => collectStrings(parseJson(record.body))).join(" ");

  expect(serialized).toContain(GRAPH_ID);
  expect(strings || serialized).toMatch(/\bupdates?\b/i);
  expect(strings || serialized).toMatch(/\bcustom\b/i);
  expect(serialized).toContain(marker);
  expect(serialized).toContain(revisionMarker);
  expect(strings || serialized).toMatch(/\bcreate\b/i);
  expect(strings || serialized).toMatch(/\bcontinue\b/i);
  expect(strings || serialized).toMatch(/\brevise\b/i);
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(goalInput(page)).toBeVisible();
  await expect(revisionInput(page)).toBeVisible();
  await expect(runButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
  await expect(continueButton(page)).toBeVisible();
  await expect(replanButton(page)).toBeVisible();

  for (const name of [
    /plan board status/i,
    /chat transcript/i,
    /^plan board$/i,
    /board actions/i,
    /execution log/i,
    /version history/i,
    /plan events/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, name)).toBeVisible();
  }
}

test("Chat + Plan Board exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Chat + Plan Board creates, continues, and replans the board", async ({ page }, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const marker = `E2E plan board marker ${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const revisionMarker = `review checkpoint ${Date.now()}`;
  await goalInput(page).fill(
    `${marker}: plan an SDK artifact rollout with explicit validation handoff and visible execution board steps.`,
  );
  await revisionInput(page).fill(`${revisionMarker}: require reviewer sign-off before launch.`);

  const streamRequests = watchStreamRequests(page);
  await runButton(page).click();

  const statusPanel = await namedPanel(page, /plan board status/i);
  const boardPanel = await namedPanel(page, /^plan board$/i);
  const actionsPanel = await namedPanel(page, /board actions/i);
  const logPanel = await namedPanel(page, /execution log/i);
  const historyPanel = await namedPanel(page, /version history/i);
  const eventsPanel = await namedPanel(page, /plan events/i);
  const finalStatePanel = await namedPanel(page, /final state/i);
  const rawEventsPanel = await namedPanel(page, /raw stream events/i);

  await waitForPanelText(statusPanel, /plan board status/i, /planned|step-2|Steps\s+4/i, 120_000);
  await waitForPanelText(boardPanel, /^plan board$/i, /completed|active|pending|Clarify outcome|Draft execution path/i);
  await waitForPanelText(logPanel, /execution log/i, /step-1|Goal clarified|completed/i);
  await waitForPanelText(eventsPanel, /plan events/i, /plan|completed|Plan board is ready/i);
  await waitForPanelText(historyPanel, /version history/i, /v1/i);
  await waitForPanelText(finalStatePanel, /final state/i, marker);
  await expect(continueButton(page)).toBeEnabled({ timeout: 90_000 });

  await continueButton(page).click();
  await waitForPanelText(statusPanel, /plan board status/i, /continued|step-3/i, 120_000);
  await waitForPanelText(boardPanel, /^plan board$/i, /Validate handoff|step-3|active/i);
  await waitForPanelText(actionsPanel, /board actions/i, /Execution continued|validation is now active/i);
  await waitForPanelText(historyPanel, /version history/i, /v2|Execution advanced/i);
  await expect(replanButton(page)).toBeEnabled({ timeout: 90_000 });

  await replanButton(page).click();
  await waitForPanelText(statusPanel, /plan board status/i, /replanned|Steps\s+5/i, 120_000);
  await waitForPanelText(boardPanel, /^plan board$/i, /Reviewer checkpoint|step-5|pending/i);
  await waitForPanelText(historyPanel, /version history/i, /v3|Replanned/i);
  await waitForPanelText(eventsPanel, /plan events/i, /replan|Plan revision stored/i);
  await waitForPanelText(finalStatePanel, /final state/i, /artifact_version|version_history|replanned|step-5/i);

  await expect(eventCards(rawEventsPanel).first()).toBeVisible({ timeout: 60_000 });
  await expect(rawEventsPanel).toContainText(/\bupdates?\b/i);
  await expect(rawEventsPanel).toContainText(/\bcustom\b/i);
  await expect(rawEventsPanel).toContainText(/chat_plan_board|plan|execute|replan|final/i);

  streamRequests.stop();
  assertStreamRequests(streamRequests.records, marker, revisionMarker);
});

test("Chat + Plan Board saves direct drag and drop board edits", async ({ page }, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const marker = `E2E draggable board marker ${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  await goalInput(page).fill(`${marker}: plan SDK rollout work with a board card that can be moved by the user.`);
  await runButton(page).click();

  const statusPanel = await namedPanel(page, /plan board status/i);
  const boardPanel = await namedPanel(page, /^plan board$/i);
  const actionsPanel = await namedPanel(page, /board actions/i);
  const logPanel = await namedPanel(page, /execution log/i);
  const historyPanel = await namedPanel(page, /version history/i);
  const finalStatePanel = await namedPanel(page, /final state/i);

  await waitForPanelText(boardPanel, /^plan board$/i, /Validate handoff|pending/i, 120_000);
  const pendingCard = boardCard(boardPanel, /Validate handoff/i);
  const blockedColumn = boardColumn(boardPanel, "blocked");

  await expect(pendingCard).toHaveAttribute("draggable", "true", { timeout: 60_000 });
  await pendingCard.dragTo(blockedColumn);

  await waitForPanelText(statusPanel, /plan board status/i, /user-edited/i, 120_000);
  await waitForPanelText(blockedColumn, /^blocked$/i, /Validate handoff/i);
  await waitForPanelText(actionsPanel, /board actions/i, /Saved Validate handoff to blocked|User moved Validate handoff to blocked/i);
  await waitForPanelText(logPanel, /execution log/i, /User moved Validate handoff to blocked|blocked/i);
  await waitForPanelText(historyPanel, /version history/i, /v2|User moved Validate handoff to blocked/i);
  await waitForPanelText(finalStatePanel, /final state/i, /user-edited|target_status|blocked/i);

  await continueButton(page).click();
  await waitForPanelText(statusPanel, /plan board status/i, /continued/i, 120_000);
  await waitForPanelText(blockedColumn, /^blocked$/i, /Validate handoff/i);
  await waitForPanelText(actionsPanel, /board actions/i, /manual board edits preserved/i);
  await waitForPanelText(historyPanel, /version history/i, /v3|Execution advanced to validation/i);
  await waitForPanelText(finalStatePanel, /final state/i, /manual board edits preserved|blocked/i);
});
