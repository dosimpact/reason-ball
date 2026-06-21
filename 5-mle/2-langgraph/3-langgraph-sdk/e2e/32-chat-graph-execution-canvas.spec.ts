import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const GRAPH_ID = "chat_graph_execution_canvas";

type StreamRequestRecord = {
  body: string;
  url: string;
};

function expectedApiUrl(page: Page) {
  const url = new URL(page.url());
  return `${url.protocol}//${url.hostname}:2931`;
}

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

function promptInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^Debugger prompt$/i }).first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runButton(page: Page) {
  return actionButton(page, /^Run graph canvas$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

function inspectButton(page: Page) {
  return actionButton(page, /^Inspect selected event$/i);
}

function replayButton(page: Page) {
  return actionButton(page, /^Time travel replay$/i);
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: /32\s+Chat \+ Graph Execution Canvas/i }).click();
  await expect(page.getByRole("heading", { name: /^(?:32\s+)?Chat \+ Graph Execution Canvas$/i })).toBeVisible();
  await expect(langGraphApiInput(page)).toHaveValue(expectedApiUrl(page));
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

function assertStreamRequests(records: StreamRequestRecord[], marker: string) {
  expect(records.length).toBeGreaterThanOrEqual(3);
  const serialized = records
    .map((record) => `${record.url}\n${JSON.stringify(parseJson(record.body) ?? record.body)}`)
    .join("\n");
  const strings = records.flatMap((record) => collectStrings(parseJson(record.body))).join(" ");

  expect(serialized).toContain(GRAPH_ID);
  expect(strings || serialized).toMatch(/\bupdates?\b/i);
  expect(strings || serialized).toMatch(/\bcustom\b/i);
  expect(serialized).toContain(marker);
  expect(strings || serialized).toMatch(/\binspect\b/i);
  expect(strings || serialized).toMatch(/\bselect_event\b/i);
  expect(strings || serialized).toMatch(/\btime_travel\b/i);
  expect(serialized).toContain("evt-5");
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(promptInput(page)).toBeVisible();
  await expect(runButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
  await expect(inspectButton(page)).toBeVisible();
  await expect(replayButton(page)).toBeVisible();

  for (const name of [
    /debugger status/i,
    /chat transcript/i,
    /graph execution canvas/i,
    /event inspector/i,
    /checkpoint timeline/i,
    /state diff/i,
    /time travel replay/i,
    /version history/i,
    /canvas events/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, name)).toBeVisible();
  }
}

test("Chat + Graph Execution Canvas exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Chat + Graph Execution Canvas inspects events and replays from a checkpoint", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const marker = `E2E graph canvas marker ${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  await promptInput(page).fill(
    `${marker}: show a graph debugger canvas with chat input, subgraph execution, checkpoints, state diff, and time travel replay.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runButton(page).click();

  const statusPanel = await namedPanel(page, /debugger status/i);
  const canvasPanel = await namedPanel(page, /graph execution canvas/i);
  const inspectorPanel = await namedPanel(page, /event inspector/i);
  const checkpointPanel = await namedPanel(page, /checkpoint timeline/i);
  const diffPanel = await namedPanel(page, /state diff/i);
  const replayPanel = await namedPanel(page, /time travel replay/i);
  const historyPanel = await namedPanel(page, /version history/i);
  const canvasEventsPanel = await namedPanel(page, /canvas events/i);
  const finalStatePanel = await namedPanel(page, /final state/i);
  const rawEventsPanel = await namedPanel(page, /raw stream events/i);

  await waitForPanelText(statusPanel, /debugger status/i, /inspected|run_subgraph|Events\s+6|Checkpoints\s+3/i, 120_000);
  await waitForPanelText(canvasPanel, /graph execution canvas/i, /Chat input|Route request|Run subgraph|checkpoint_state|summarize_result/i);
  await waitForPanelText(inspectorPanel, /event inspector/i, /evt-1|evt-3|Debugger context retrieved|evt-6/i);
  await waitForPanelText(checkpointPanel, /checkpoint timeline/i, /cp-1|cp-2|cp-3|Replay anchor/i);
  await waitForPanelText(diffPanel, /state diff/i, /event_id|evt-3|active_node|retrieve_context/i);
  await waitForPanelText(historyPanel, /version history/i, /v1|Graph debugger canvas/i);
  await waitForPanelText(canvasEventsPanel, /canvas events/i, /inspect|completed|Canvas artifact is ready/i);
  await waitForPanelText(finalStatePanel, /final state/i, marker);
  await expect(inspectButton(page)).toBeEnabled({ timeout: 90_000 });

  await inspectorPanel.getByRole("button", { name: /evt-5/i }).click();
  await inspectButton(page).click();
  await waitForPanelText(statusPanel, /debugger status/i, /selected|checkpoint_state/i, 120_000);
  await waitForPanelText(diffPanel, /state diff/i, /evt-5|selected_event|checkpoint_state/i);
  await waitForPanelText(historyPanel, /version history/i, /v2|Selected evt-5/i);

  await replayButton(page).click();
  await waitForPanelText(statusPanel, /debugger status/i, /replayed|checkpoint_state/i, 120_000);
  await waitForPanelText(replayPanel, /time travel replay/i, /Replayed from cp-3 at evt-5|checkpoint_state/i);
  await waitForPanelText(historyPanel, /version history/i, /v3|Replayed from cp-3/i);
  await waitForPanelText(finalStatePanel, /final state/i, /artifact_version|version_history|replayed|evt-5/i);

  await expect(eventCards(rawEventsPanel).first()).toBeVisible({ timeout: 60_000 });
  await expect(rawEventsPanel).toContainText(/\bupdates?\b/i);
  await expect(rawEventsPanel).toContainText(/\bcustom\b/i);
  await expect(rawEventsPanel).toContainText(/chat_graph_execution_canvas|inspect|select_event|time_travel|final/i);

  streamRequests.stop();
  assertStreamRequests(streamRequests.records, marker);
});
