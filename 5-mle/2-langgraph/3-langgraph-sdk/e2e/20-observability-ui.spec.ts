import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "observability";

type StreamRequestRecord = {
  body: string;
  url: string;
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseJson(value: string): JsonValue | undefined {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return undefined;
  }
}

function collectStrings(value: JsonValue | undefined): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return [value];
  if (typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);

  return Object.values(value).flatMap(collectStrings);
}

function collectStringValuesForKeys(
  value: JsonValue | undefined,
  keyPattern: RegExp,
): string[] {
  if (value === undefined || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValuesForKeys(item, keyPattern));
  }

  return Object.entries(value).flatMap(([key, childValue]) => {
    const childStrings = collectStringValuesForKeys(childValue, keyPattern);
    if (!keyPattern.test(key)) return childStrings;
    return [...collectStrings(childValue), ...childStrings];
  });
}

function keyPattern(key: string) {
  return new RegExp(`\\b${escapeRegExp(key).replace("_", "[_ ]")}\\b`, "i");
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
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  await page.getByRole("button", { name: /20 Observability UI/i }).click();

  await expect(page.getByRole("heading", { name: /^Observability UI$/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    API_URL,
  );
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function observableQueryInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^observable query$/i })
    .or(root.getByPlaceholder(/observable query|query|prompt/i))
    .or(root.locator("textarea"))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runButton(page: Page) {
  return actionButton(page, /^Run observable graph$/i);
}

function useToolQueryButton(page: Page) {
  return actionButton(page, /^Use tool query$/i);
}

function useSummaryQueryButton(page: Page) {
  return actionButton(page, /^Use summary query$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
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
  timeout = 45_000,
) {
  const pattern =
    typeof textOrPattern === "string" ? new RegExp(escapeRegExp(textOrPattern)) : textOrPattern;
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).toMatch(pattern);
}

function eventRows(panel: Locator) {
  return panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]");
}

function nodeTimingRows(panel: Locator) {
  return panel
    .locator(".node-timing-row, tr, li, article, details, [data-testid*='node' i]")
    .filter({ hasText: /ms|seconds?|duration|elapsed|latency/i });
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

function assertStreamRequestBodies(records: StreamRequestRecord[], queryMarker: string) {
  expect(records.length).toBeGreaterThanOrEqual(1);

  const serializedRecords = records
    .map((record) => {
      const parsed = parseJson(record.body);
      return `${record.url}\n${JSON.stringify(parsed ?? record.body)}`;
    })
    .join("\n");

  const streamModeText = records
    .flatMap((record) => {
      const parsed = parseJson(record.body);
      return collectStringValuesForKeys(parsed, /stream/i);
    })
    .join(" ");

  expect(serializedRecords).toContain(GRAPH_ID);
  expect(serializedRecords).toContain(queryMarker);
  expect(streamModeText || serializedRecords).toMatch(/\bupdates?\b/i);
  expect(streamModeText || serializedRecords).toMatch(/\bcustom\b/i);
}

async function assertInitialSurface(page: Page) {
  await expect(await namedPanel(page, /run metrics/i)).toBeVisible();
  await expect(await namedPanel(page, /node timings/i)).toBeVisible();
  await expect(await namedPanel(page, /token usage/i)).toBeVisible();
  await expect(await namedPanel(page, /cost estimate/i)).toBeVisible();
  await expect(await namedPanel(page, /trace links/i)).toBeVisible();
  await expect(await namedPanel(page, /run metadata/i)).toBeVisible();
  await expect(await namedPanel(page, /observability events/i)).toBeVisible();
  await expect(await namedPanel(page, /final answer/i)).toBeVisible();
  await expect(await namedPanel(page, /final state/i)).toBeVisible();
  await expect(await namedPanel(page, /raw stream events/i)).toBeVisible();

  await expect(observableQueryInput(page)).toBeVisible();
  await expect(runButton(page)).toBeVisible();
  await expect(useToolQueryButton(page)).toBeVisible();
  await expect(useSummaryQueryButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
}

async function assertRunMetrics(page: Page) {
  const panel = await namedPanel(page, /run metrics/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /run metrics/i, /complete|success|duration|latency|elapsed|ms|seconds?/i);
  await expect(panel).toContainText(/complete|success|final|duration|latency|elapsed/i);
  await expect(panel).toContainText(/ms|seconds?|\d/i);
}

async function assertNodeTimings(page: Page) {
  const panel = await namedPanel(page, /node timings/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /node timings/i, /node|model|llm|tool|answer|ms|seconds?/i, 60_000);

  const rows = nodeTimingRows(panel);
  await expect.poll(async () => rows.count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  await expect(rows.first()).toContainText(/ms|seconds?|duration|elapsed|latency/i);
}

async function assertTokenUsage(page: Page) {
  const panel = await namedPanel(page, /token usage/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /token usage/i, /tokens?|unknown|\d/i, 60_000);
  await expect(panel).toContainText(/tokens?/i);
  await expect(panel).toContainText(/total/i);
  await expect(panel).toContainText(/input|prompt/i);
  await expect(panel).toContainText(/output|completion/i);

  const text = await panelBodyText(panel, /token usage/i);
  expect(text).toMatch(/unknown|\d/i);
}

async function assertCostEstimate(page: Page) {
  const panel = await namedPanel(page, /cost estimate/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /cost estimate/i, /cost|estimate|unknown|\$|usd|\d/i, 60_000);
  await expect(panel).toContainText(/cost|estimate/i);
  await expect(panel).toContainText(/total|input|prompt|output|completion/i);

  const text = await panelBodyText(panel, /cost estimate/i);
  expect(text).toMatch(/unknown|\$|usd|\d/i);
}

async function assertTraceLinks(page: Page) {
  const panel = await namedPanel(page, /trace links/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /trace links/i,
    /trace|langsmith|run|url|not configured|unavailable|missing|unknown/i,
    60_000,
  );

  const links = panel.locator("a[href]");
  if ((await links.count()) > 0) {
    const href = await links.first().getAttribute("href");
    expect(href ?? "").toMatch(/^https?:\/\//);
    await expect(panel).toContainText(/trace|langsmith|run/i);
  } else {
    await expect(panel).toContainText(/not configured|unavailable|missing|unknown|no trace/i);
  }
}

async function assertRunMetadata(page: Page) {
  const panel = await namedPanel(page, /run metadata/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /run metadata/i, /run|thread|graph|model|provider|openai|gpt/i, 60_000);
  await expect(panel).toContainText(/run|thread/i);
  await expect(panel).toContainText(/graph/i);
  await expect(panel).toContainText(GRAPH_ID);
  await expect(panel).toContainText(/model|provider/i);
  await expect(panel).toContainText(/openai|gpt/i);
}

async function assertObservabilityEvents(page: Page) {
  const panel = await namedPanel(page, /observability events/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /observability events/i,
    /observability|node|timing|token|cost|trace|metadata|custom/i,
    60_000,
  );
  await expect(eventRows(panel).first()).toBeVisible();
  await expect(panel).toContainText(/observability|node|timing|token|cost|trace|metadata/i);
}

async function assertFinalAnswer(page: Page) {
  const panel = await namedPanel(page, /final answer/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /final answer/i, /[A-Za-z][\s\S]{30,}/, 120_000);
  await expect(panel).not.toContainText(/no final answer yet|waiting/i);
}

async function assertFinalState(page: Page, queryMarker: string) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /final state/i, /node_timings|token_metrics|cost_summary/i, 60_000);

  for (const key of [
    "node_timings",
    "token_metrics",
    "cost_summary",
    "run_metadata",
    "trace_links",
    "observability_events",
    "answer",
    "final",
  ]) {
    await expect(panel).toContainText(keyPattern(key));
  }

  await expect(panel).toContainText(queryMarker);
}

async function assertRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(eventRows(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/\bupdates?\b/i);
  await expect(panel).toContainText(/\bcustom\b/i);
  await expect(panel).toContainText(/node_timings|token_metrics|observability_events|run_metadata/i);
}

test("Observability UI exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Observability UI streams an OpenAI-backed run with telemetry panels", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const queryMarker = `E2E observability marker ${uniqueId}`;

  await useToolQueryButton(page).click();
  await expect
    .poll(async () => observableQueryInput(page).inputValue(), { timeout: 10_000 })
    .toMatch(/\S{10,}/);

  const seededQuery = await observableQueryInput(page).inputValue();
  const query = `${seededQuery}\n\n${queryMarker}: answer briefly and preserve telemetry for node timings, token usage, trace links, and run metadata.`;
  await observableQueryInput(page).fill(query);

  const streamRequests = watchStreamRequests(page);
  await runButton(page).click();

  await assertFinalAnswer(page);
  await assertRunMetrics(page);
  await assertNodeTimings(page);
  await assertTokenUsage(page);
  await assertCostEstimate(page);
  await assertTraceLinks(page);
  await assertRunMetadata(page);
  await assertObservabilityEvents(page);
  await assertFinalState(page, queryMarker);
  await assertRawEvents(page);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records, queryMarker);
});
