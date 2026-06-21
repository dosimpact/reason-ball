import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const GRAPH_ID = "chat_data_analysis_canvas";

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

function requestInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^Analysis request$/i }).first();
}

function datasetNameInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^Dataset name$/i }).first();
}

function csvInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^CSV data$/i }).first();
}

function csvUploadInput(page: Page) {
  return workspace(page).getByLabel(/^CSV upload$/i).first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runButton(page: Page) {
  return actionButton(page, /^Run analysis$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

function retryButton(page: Page) {
  return actionButton(page, /^Retry analysis$/i);
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: /34\s+Chat \+ Data Analysis Canvas/i }).click();
  await expect(page.getByRole("heading", { name: /^(?:34\s+)?Chat \+ Data Analysis Canvas$/i })).toBeVisible();
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
  expect(records.length).toBeGreaterThanOrEqual(2);
  const serialized = records
    .map((record) => `${record.url}\n${JSON.stringify(parseJson(record.body) ?? record.body)}`)
    .join("\n");
  const strings = records.flatMap((record) => collectStrings(parseJson(record.body))).join(" ");

  expect(serialized).toContain(GRAPH_ID);
  expect(strings || serialized).toMatch(/\bupdates?\b/i);
  expect(strings || serialized).toMatch(/\bcustom\b/i);
  expect(serialized).toContain(marker);
  expect(strings || serialized).toMatch(/\banalyze\b/i);
  expect(strings || serialized).toMatch(/\bretry\b/i);
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(requestInput(page)).toBeVisible();
  await expect(datasetNameInput(page)).toBeVisible();
  await expect(csvUploadInput(page)).toBeVisible();
  await expect(csvInput(page)).toBeVisible();
  await expect(runButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
  await expect(retryButton(page)).toBeVisible();

  for (const name of [
    /analysis status/i,
    /chat transcript/i,
    /dataset preview/i,
    /generated code/i,
    /result table/i,
    /chart canvas/i,
    /sandbox logs/i,
    /retry controls/i,
    /analysis steps/i,
    /insights/i,
    /analysis events/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, name)).toBeVisible();
  }
}

test("Chat + Data Analysis Canvas exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Chat + Data Analysis Canvas analyzes CSV data and retries on the same thread", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const marker = `E2E data marker ${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const csvFixture = `channel,visitors,signups,revenue
Organic,4200,504,30240
Paid Search,3100,279,19530
Referral,1800,252,17640
Email,2400,384,26880
Partner,950,171,13680`;
  await csvUploadInput(page).setInputFiles({
    name: "e2e_campaign_metrics.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvFixture),
  });
  await expect(datasetNameInput(page)).toHaveValue("e2e_campaign_metrics.csv");
  await expect(csvInput(page)).toHaveValue(csvFixture);
  await requestInput(page).fill(
    `${marker}: analyze conversion by channel, produce a result table, chart canvas, sandbox logs, and retry-safe summary.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runButton(page).click();

  const statusPanel = await namedPanel(page, /analysis status/i);
  const datasetPanel = await namedPanel(page, /dataset preview/i);
  const codePanel = await namedPanel(page, /generated code/i);
  const resultPanel = await namedPanel(page, /result table/i);
  const chartPanel = await namedPanel(page, /chart canvas/i);
  const logsPanel = await namedPanel(page, /sandbox logs/i);
  const retryPanel = await namedPanel(page, /retry controls/i);
  const stepsPanel = await namedPanel(page, /analysis steps/i);
  const insightsPanel = await namedPanel(page, /insights/i);
  const analysisEventsPanel = await namedPanel(page, /analysis events/i);
  const finalStatePanel = await namedPanel(page, /final state/i);
  const rawEventsPanel = await namedPanel(page, /raw stream events/i);

  await waitForPanelText(statusPanel, /analysis status/i, /analyzed|completed|Rows\s+5/i, 120_000);
  await waitForPanelText(datasetPanel, /dataset preview/i, /Organic|Paid Search|visitors|revenue|number/i);
  await waitForPanelText(codePanel, /generated code/i, /chat_data_analysis_canvas|parse_csv|chart_specs|sandbox/i);
  await waitForPanelText(resultPanel, /result table/i, /column|visitors|signups|revenue|mean/i);
  await waitForPanelText(chartPanel, /chart canvas/i, /Average|visitors|Organic|Paid Search/i);
  await waitForPanelText(logsPanel, /sandbox logs/i, /memory-only|Parsed 5 row|no eval|chart spec/i);
  await waitForPanelText(stepsPanel, /analysis steps/i, /Load CSV|Profile columns|Run sandbox|completed/i);
  await waitForPanelText(insightsPanel, /insights/i, /rows|numeric|categorical|channel|chart/i);
  await waitForPanelText(analysisEventsPanel, /analysis events/i, /parse|sandbox|summarize|final/i);
  await waitForPanelText(finalStatePanel, /final state/i, /dataset_metadata|parsed_columns|chart_specs|result_table/i);
  await expect(retryButton(page)).toBeEnabled({ timeout: 90_000 });

  await retryButton(page).click();
  await waitForPanelText(statusPanel, /analysis status/i, /retried|Retry|Retries\s+1/i, 120_000);
  await waitForPanelText(logsPanel, /sandbox logs/i, /Retry 1 requested|Cleared|repair|memory-only/i);
  await waitForPanelText(retryPanel, /retry controls/i, /Retry count is 1|retried|analysis/i);
  await waitForPanelText(finalStatePanel, /final state/i, /"retry_count": 1|retried|analysis_events/i);

  await expect(eventCards(rawEventsPanel).first()).toBeVisible({ timeout: 60_000 });
  await expect(rawEventsPanel).toContainText(/\bupdates?\b/i);
  await expect(rawEventsPanel).toContainText(/\bcustom\b/i);
  await expect(rawEventsPanel).toContainText(/chat_data_analysis_canvas|retry|parse|sandbox|final/i);

  streamRequests.stop();
  assertStreamRequests(streamRequests.records, marker);
});
