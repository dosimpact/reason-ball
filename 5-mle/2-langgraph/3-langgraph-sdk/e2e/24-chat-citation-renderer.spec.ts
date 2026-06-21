import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "chat_citation_renderer";
const PRIMARY_SOURCE_ID = "doc-rag";

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
  keyPatternMatcher: RegExp,
): string[] {
  if (value === undefined || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValuesForKeys(item, keyPatternMatcher));
  }

  return Object.entries(value).flatMap(([key, childValue]) => {
    const childStrings = collectStringValuesForKeys(childValue, keyPatternMatcher);
    if (!keyPatternMatcher.test(key)) return childStrings;
    return [...collectStrings(childValue), ...childStrings];
  });
}

function fieldPattern(...fieldNames: string[]) {
  const variants = fieldNames.flatMap((fieldName) => [
    fieldName,
    fieldName.replace(/([a-z])([A-Z])/g, "$1_$2"),
    fieldName.replace(/_/g, " "),
    fieldName.replace(/_/g, "-"),
  ]);
  const sources = variants.map((variant) =>
    escapeRegExp(variant).replace(/[_\s-]+/g, "[_\\s-]*"),
  );

  return new RegExp(`\\b(?:${sources.join("|")})\\b`, "i");
}

function citationTokenPattern(sourceId = PRIMARY_SOURCE_ID) {
  return new RegExp(`(?:\\[\\s*)?${escapeRegExp(sourceId)}(?:\\s*\\])?`, "i");
}

async function isVisible(locator: Locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
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

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function langGraphApiInput(page: Page) {
  const root = workspace(page);
  return root.getByRole("textbox", { name: /api url|langgraph api url/i }).first();
}

function citationQuestionInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Citation question$/i })
    .or(root.getByRole("textbox", { name: /citation question|question|prompt/i }))
    .or(root.getByPlaceholder(/citation question|question|prompt/i))
    .or(root.locator("textarea"))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function useEvidenceSampleButton(page: Page) {
  return actionButton(page, /^Use evidence sample$/i);
}

function useStreamSampleButton(page: Page) {
  return actionButton(page, /^Use stream sample$/i);
}

function runCitationRendererButton(page: Page) {
  return actionButton(page, /^Run citation renderer$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  await page.getByRole("button", { name: /^24 Chat Citation Renderer(?: implemented)?$/i }).click();

  await expect(
    page.getByRole("heading", { name: /^(?:24\s+)?Chat Citation Renderer$/i }),
  ).toBeVisible();
  await expect(langGraphApiInput(page)).toHaveValue(API_URL);
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(/waiting|no .* yet|run .* to .*|empty|not available/gi, ""),
  );
}

async function combinedPanelBodyText(panels: Array<{ panel: Locator; title: RegExp }>) {
  const texts = await Promise.all(
    panels.map(async ({ panel, title }) => panelBodyText(panel, title)),
  );
  return normalizeText(texts.join(" "));
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

function eventCards(panel: Locator) {
  return panel.locator(
    [
      ".event-row",
      ".citation-event",
      ".citation-card",
      ".source-card",
      ".map-row",
      "[class*='event' i]",
      "[class*='citation' i]",
      "[class*='source' i]",
      "[class*='segment' i]",
      "[data-testid*='event' i]",
      "[data-testid*='citation' i]",
      "[data-testid*='source' i]",
      "article",
      "details",
      "pre",
      "code",
      "li",
      "tr",
    ].join(", "),
  );
}

function selectedSourceDocument(panel: Locator, sourceId = PRIMARY_SOURCE_ID) {
  return panel
    .locator(
      [
        "[aria-current='true']",
        "[aria-selected='true']",
        "[data-selected='true']",
        "[data-active='true']",
        "[data-highlighted='true']",
        "[class*='active' i]",
        "[class*='current' i]",
        "[class*='highlight' i]",
        "[class*='selected' i]",
      ].join(", "),
    )
    .filter({ hasText: citationTokenPattern(sourceId) })
    .first();
}

async function citationChip(panel: Locator, sourceId = PRIMARY_SOURCE_ID) {
  const token = citationTokenPattern(sourceId);
  const candidates = [
    panel.getByRole("button", { name: token }).first(),
    panel.getByRole("link", { name: token }).first(),
    panel
      .locator(
        [
          `[data-citation-id="${sourceId}"]`,
          `[data-source-id="${sourceId}"]`,
          `[data-citation-source="${sourceId}"]`,
          `[data-testid*="${sourceId}" i]`,
        ].join(", "),
      )
      .first(),
    panel
      .locator(
        [
          ".citation-chip",
          ".source-chip",
          "[class*='citation' i]",
          "[class*='source-chip' i]",
        ].join(", "),
      )
      .filter({ hasText: token })
      .first(),
    panel.getByText(token).first(),
  ];

  for (const candidate of candidates) {
    if (await isVisible(candidate)) return candidate;
  }

  return candidates[candidates.length - 1];
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

function assertStreamRequestBodies(
  records: StreamRequestRecord[],
  requiredPayloadMarkers: Array<string | RegExp>,
) {
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
  expect(streamModeText || serializedRecords).toMatch(/\bupdates?\b/i);
  expect(streamModeText || serializedRecords).toMatch(/\bcustom\b/i);

  for (const marker of requiredPayloadMarkers) {
    if (typeof marker === "string") {
      expect(serializedRecords).toContain(marker);
    } else {
      expect(serializedRecords).toMatch(marker);
    }
  }
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(citationQuestionInput(page)).toBeVisible();
  await expect(useEvidenceSampleButton(page)).toBeVisible();
  await expect(useStreamSampleButton(page)).toBeVisible();
  await expect(runCitationRendererButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();

  for (const panelName of [
    /citation status/i,
    /chat answer with citations/i,
    /citation preview/i,
    /source documents/i,
    /citation map/i,
    /final answer/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, panelName)).toBeVisible();
  }
}

async function waitForCitationSignalBeforeFinalAnswer(page: Page) {
  const citationPanels = [
    { panel: await namedPanel(page, /citation status/i), title: /citation status/i },
    {
      panel: await namedPanel(page, /chat answer with citations/i),
      title: /chat answer with citations/i,
    },
    { panel: await namedPanel(page, /citation map/i), title: /citation map/i },
  ];
  const finalAnswer = await namedPanel(page, /final answer/i);

  await expect
    .poll(
      async () => {
        const citationText = await combinedPanelBodyText(citationPanels);
        const finalText = await panelBodyText(finalAnswer, /final answer/i);
        const hasCitationSignal =
          /citation|source|document|segment|sentence|custom|stream|running|status/i.test(
            citationText,
          );
        const hasFinalAnswer =
          /[A-Za-z][\s\S]{30,}/.test(finalText) &&
          !/no final answer yet|waiting|run .* to/i.test(finalText);

        if (hasCitationSignal) return "citation";
        if (hasFinalAnswer) return "final-answer";
        return "pending";
      },
      { timeout: 90_000 },
    )
    .toBe("citation");
}

async function assertCitationStatus(page: Page) {
  const panel = await namedPanel(page, /citation status/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /citation status/i,
    /citation|source|evidence|status|queued|running|streaming|complete|completed|final|done/i,
    60_000,
  );
}

async function assertChatAnswerWithCitations(page: Page) {
  const panel = await namedPanel(page, /chat answer with citations/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /chat answer with citations/i,
    citationTokenPattern(PRIMARY_SOURCE_ID),
    120_000,
  );
  await waitForPanelText(panel, /chat answer with citations/i, /[A-Za-z][\s\S]{30,}/, 120_000);

  const chip = await citationChip(panel);
  await expect(chip).toBeVisible({ timeout: 60_000 });
}

async function assertSourceDocuments(page: Page) {
  const panel = await namedPanel(page, /source documents/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /source documents/i, citationTokenPattern(PRIMARY_SOURCE_ID), 90_000);
  await expect(panel).toContainText(/source|document|evidence|rag/i);
}

async function assertCitationPreviewAndHighlight(page: Page) {
  const answerPanel = await namedPanel(page, /chat answer with citations/i);
  const previewPanel = await namedPanel(page, /citation preview/i);
  const sourcePanel = await namedPanel(page, /source documents/i);
  const chip = await citationChip(answerPanel);

  await chip.click();

  await expect(previewPanel).toBeVisible();
  await waitForPanelText(
    previewPanel,
    /citation preview/i,
    /doc-rag|citation|source|document|sentence|segment|evidence/i,
    60_000,
  );
  await expect(previewPanel).toContainText(citationTokenPattern(PRIMARY_SOURCE_ID));

  await expect
    .poll(async () => (await isVisible(selectedSourceDocument(sourcePanel)) ? 1 : 0), {
      timeout: 60_000,
    })
    .toBeGreaterThanOrEqual(1);
}

async function assertCitationMap(page: Page) {
  const panel = await namedPanel(page, /citation map/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /citation map/i,
    /sentence|segment|source|doc-rag|citation|maps?|connect|->|id/i,
    90_000,
  );
  await expect(panel).toContainText(/sentence|segment/i);
  await expect(panel).toContainText(/source|doc-rag/i);
  await expect(eventCards(panel).first()).toBeVisible({ timeout: 60_000 });
}

async function assertFinalAnswer(page: Page) {
  const panel = await namedPanel(page, /final answer/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /final answer/i, /[A-Za-z][\s\S]{30,}/, 120_000);
  await expect(panel).not.toContainText(/no final answer yet|waiting/i);

  const finalAnswerText = await panelBodyText(panel, /final answer/i);
  expect(finalAnswerText).not.toMatch(
    /answer_segments|citation_events|raw stream events|\bupdates?\b|\bcustom\b/i,
  );
}

async function assertFinalState(page: Page, options: { marker: string }) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /final state/i,
    /question|sources|answer|segments|citations|citation_events|final_status|final/i,
    90_000,
  );

  await expect(panel).toContainText(options.marker);
  await expect(panel).toContainText(citationTokenPattern(PRIMARY_SOURCE_ID));

  for (const pattern of [
    fieldPattern("question"),
    fieldPattern("sources"),
    fieldPattern("answer_segments", "answerSegments", "answer segments"),
    fieldPattern("citations"),
    fieldPattern("citation_events", "citationEvents", "citation events"),
    fieldPattern("answer", "final_answer", "finalAnswer"),
    fieldPattern("final"),
    fieldPattern("final_status", "finalStatus", "final status"),
  ]) {
    await expect(panel).toContainText(pattern);
  }
}

async function assertRawStreamEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(eventCards(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/\bupdates?\b/i);
  await expect(panel).toContainText(/\bcustom\b/i);
  await expect(panel).toContainText(/citation|source|segment|document|answer|final/i);
}

test("Chat Citation Renderer exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Chat Citation Renderer streams citations and opens source previews", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const marker = `E2E chat citation renderer marker ${uniqueId}`;

  await useEvidenceSampleButton(page).click();
  await expect
    .poll(async () => citationQuestionInput(page).inputValue(), { timeout: 10_000 })
    .toMatch(/[\s\S]{10,}/);

  const seededQuestion = await citationQuestionInput(page).inputValue();
  await citationQuestionInput(page).fill(
    `${seededQuestion}\n\n${marker}: answer with inline citation chips and cite the RAG source as [doc-rag].`,
  );

  const streamRequests = watchStreamRequests(page);
  await runCitationRendererButton(page).click();

  await waitForCitationSignalBeforeFinalAnswer(page);
  await assertCitationStatus(page);
  await assertChatAnswerWithCitations(page);
  await assertSourceDocuments(page);
  await assertCitationPreviewAndHighlight(page);
  await assertCitationMap(page);
  await assertFinalAnswer(page);
  await assertFinalState(page, { marker });
  await assertRawStreamEvents(page);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records, [marker]);
});
