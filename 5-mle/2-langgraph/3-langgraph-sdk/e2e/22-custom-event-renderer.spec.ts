import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "custom_event_renderer";

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

function taskIdInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Task ID$/i })
    .or(root.getByLabel(/^Task ID$/i))
    .or(root.getByPlaceholder(/task id/i))
    .first();
}

function taskPromptInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Task prompt$/i })
    .or(root.getByRole("textbox", { name: /task prompt|prompt/i }))
    .or(root.getByPlaceholder(/task prompt|prompt|request/i))
    .or(root.locator("textarea"))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function useWarningSampleButton(page: Page) {
  return actionButton(page, /^Use warning sample$/i);
}

function useCleanSampleButton(page: Page) {
  return actionButton(page, /^Use clean sample$/i);
}

function runRendererButton(page: Page) {
  return actionButton(page, /^Run renderer$/i);
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

  await page.getByRole("button", { name: /22 Custom Event Renderer/i }).click();

  await expect(
    page.getByRole("heading", { name: /^(?:22\s+)?Custom Event Renderer$/i }),
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
      ".renderer-event",
      ".phase-card",
      ".warning-card",
      "[class*='event' i]",
      "[class*='card' i]",
      "[data-testid*='event' i]",
      "[data-testid*='renderer' i]",
      "article",
      "details",
      "pre",
      "code",
      "li",
      "tr",
    ].join(", "),
  );
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
  await expect(taskIdInput(page)).toBeVisible();
  await expect(taskPromptInput(page)).toBeVisible();
  await expect(useWarningSampleButton(page)).toBeVisible();
  await expect(useCleanSampleButton(page)).toBeVisible();
  await expect(runRendererButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();

  for (const panelName of [
    /renderer status/i,
    /inline event renderer/i,
    /phase progress/i,
    /warning events/i,
    /unknown event inspector/i,
    /final answer/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, panelName)).toBeVisible();
  }
}

async function assertRendererStatus(page: Page) {
  const panel = await namedPanel(page, /renderer status/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /renderer status/i,
    /running|complete|completed|success|final|done|status|phase|warning/i,
    60_000,
  );
  await expect(panel).toContainText(/renderer|status|running|complete|completed|success|final|done/i);
}

async function assertInlineEventRenderer(page: Page) {
  const inlinePanel = await namedPanel(page, /inline event renderer/i);
  await expect(inlinePanel).toBeVisible();
  await waitForPanelText(
    inlinePanel,
    /inline event renderer/i,
    /phase|progress|status|warning|diagnostic|custom/i,
    60_000,
  );

  const cards = eventCards(inlinePanel);
  await expect.poll(async () => cards.count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
  await expect(inlinePanel).toContainText(/phase|progress|status/i);
  await expect(inlinePanel).toContainText(/warning|diagnostic|custom/i);
}

async function assertPhaseProgress(page: Page) {
  const panel = await namedPanel(page, /phase progress/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /phase progress/i,
    /phase|progress|status|queued|running|complete|completed|done|%|\d+\s*\/\s*\d+/i,
    60_000,
  );
  await expect(panel).toContainText(/phase|step|stage/i);
  await expect(panel).toContainText(/progress|%|\d+\s*\/\s*\d+|complete|completed|done/i);

  const progressbar = panel.getByRole("progressbar").first();
  if (await isVisible(progressbar)) {
    await expect(progressbar).toBeVisible();
  }
}

async function assertWarningEvents(page: Page) {
  const panel = await namedPanel(page, /warning events/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /warning events/i, /warning|warn|risk|attention|issue/i, 60_000);
  await expect(eventCards(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/warning|warn|risk|attention|issue/i);
}

async function assertUnknownEventInspector(page: Page) {
  const panel = await namedPanel(page, /unknown event inspector/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /unknown event inspector/i,
    /unknown|diagnostic|raw|payload|json|event|inspect/i,
    60_000,
  );
  await expect(eventCards(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/unknown|diagnostic/i);
  await expect(panel).toContainText(/raw|payload|json|event|inspect/i);
}

async function assertFinalAnswer(page: Page) {
  const panel = await namedPanel(page, /final answer/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /final answer/i, /[A-Za-z][\s\S]{30,}/, 120_000);
  await expect(panel).not.toContainText(/no final answer yet|waiting/i);
  await expect(panel).not.toContainText(/event_kind|event kind|unknown_diagnostic|raw payload/i);
}

async function assertInlineEventsAreDistinctFromAssistantMessage(page: Page) {
  const inlinePanel = await namedPanel(page, /inline event renderer/i);
  const finalAnswer = await namedPanel(page, /final answer/i);

  const inlineText = normalizeText(await inlinePanel.locator(".renderer-event-card").allInnerTexts().then((texts) => texts.join(" ")));
  const finalText = await panelBodyText(finalAnswer, /final answer/i);
  const answerSnippet = normalizeText(finalText).slice(0, 40);

  expect(inlineText).toMatch(/phase|progress|status|warning|diagnostic|custom/i);
  expect(finalText).toMatch(/[A-Za-z][\s\S]{30,}/);
  expect(normalizeText(inlineText)).not.toContain(answerSnippet);
}

async function assertFinalState(page: Page, options: { taskId: string; marker: string }) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /final state/i,
    /task|prompt|renderer|phase|progress|warning|unknown|answer|final/i,
    90_000,
  );

  await expect(panel).toContainText(options.taskId);
  await expect(panel).toContainText(options.marker);

  for (const pattern of [
    fieldPattern("task_id", "taskId", "task id"),
    fieldPattern("task_prompt", "taskPrompt", "task prompt", "prompt"),
    fieldPattern("renderer_status", "rendererStatus", "status"),
    fieldPattern("phase_progress", "phaseProgress", "phase_events", "phases"),
    fieldPattern("warning_events", "warningEvents", "warnings"),
    fieldPattern("unknown_events", "unknownEvents", "unknown_diagnostics", "diagnostics"),
    fieldPattern("answer", "final_answer", "finalAnswer"),
    fieldPattern("final_status", "finalStatus", "final"),
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
  await expect(panel).toContainText(/phase|progress|status|warning|diagnostic|unknown/i);
}

test("Custom Event Renderer exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Custom Event Renderer streams custom renderer events separately from the final answer", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const taskId = `e2e-renderer-${uniqueId}`;
  const marker = `E2E custom event renderer marker ${uniqueId}`;

  await useWarningSampleButton(page).click();
  await expect
    .poll(async () => taskPromptInput(page).inputValue(), { timeout: 10_000 })
    .toMatch(/\S{10,}/);

  const seededPrompt = await taskPromptInput(page).inputValue();
  await taskIdInput(page).fill(taskId);
  await taskPromptInput(page).fill(
    `${seededPrompt}\n\n${marker}: emit phase, progress, status, warning, and unknown diagnostic events before a concise final answer.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runRendererButton(page).click();

  await assertRendererStatus(page);
  await assertInlineEventRenderer(page);
  await assertPhaseProgress(page);
  await assertWarningEvents(page);
  await assertUnknownEventInspector(page);
  await assertFinalAnswer(page);
  await assertInlineEventsAreDistinctFromAssistantMessage(page);
  await assertFinalState(page, { taskId, marker });
  await assertRawStreamEvents(page);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records, [taskId, marker]);
});
