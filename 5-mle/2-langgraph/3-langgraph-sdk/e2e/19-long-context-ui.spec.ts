import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "long_context";

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

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "assistant",
  "because",
  "before",
  "being",
  "context",
  "conversation",
  "earlier",
  "every",
  "facts",
  "follow",
  "from",
  "have",
  "into",
  "latest",
  "message",
  "messages",
  "preserved",
  "previous",
  "recent",
  "seed",
  "summary",
  "summarized",
  "that",
  "their",
  "there",
  "these",
  "this",
  "turns",
  "using",
  "with",
]);

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
  if (Array.isArray(value)) return value.flatMap((item) => collectStringValuesForKeys(item, keyPattern));

  return Object.entries(value).flatMap(([key, childValue]) => {
    const childStrings = collectStringValuesForKeys(childValue, keyPattern);
    if (!keyPattern.test(key)) return childStrings;
    return [...collectStrings(childValue), ...childStrings];
  });
}

function significantTerms(value: string) {
  const terms = value.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) ?? [];
  return Array.from(new Set(terms)).filter((term) => !STOP_WORDS.has(term)).slice(0, 20);
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

  await page.getByRole("button", { name: /19 Long Context UI/i }).click();

  await expect(page.getByRole("heading", { name: /Long Context UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    API_URL,
  );
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function followUpInput(page: Page) {
  return workspace(page)
    .getByRole("textbox", { name: /^follow-up message$/i })
    .or(workspace(page).getByPlaceholder(/follow-up message|follow up|message/i))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function newThreadButton(page: Page) {
  return actionButton(page, /^New context thread$/i);
}

function seedButton(page: Page) {
  return actionButton(page, /^Seed long conversation$/i);
}

function sendButton(page: Page) {
  return actionButton(page, /^Send message$/i);
}

function reloadButton(page: Page) {
  return actionButton(page, /^Reload state$/i);
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

function messageRows(panel: Locator) {
  return panel
    .locator(".message-card, [data-testid*='message' i], article, li, details")
    .filter({ hasText: /user|assistant|human|ai|message|turn|seed|summary/i });
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

function threadIdFromRecord(record: StreamRequestRecord) {
  const urlMatch = decodeURIComponent(record.url).match(/\/threads\/([^/?#]+)\/runs\/stream/i);
  if (urlMatch?.[1]) return urlMatch[1];

  const parsed = parseJson(record.body);
  return collectStringValuesForKeys(parsed, /^(thread_id|threadId)$/).find(Boolean);
}

function assertStreamRequestBodies(records: StreamRequestRecord[]) {
  expect(records.length).toBeGreaterThanOrEqual(2);

  for (const record of records.slice(0, 2)) {
    const parsed = parseJson(record.body);
    const serialized = JSON.stringify(parsed ?? record.body);
    const streamModeValues = collectStringValuesForKeys(parsed, /stream/i).join(" ");

    expect(serialized).toContain(GRAPH_ID);
    expect(streamModeValues || serialized).toMatch(/\bupdates?\b/i);
    expect(streamModeValues || serialized).toMatch(/\bcustom\b/i);
  }
}

function assertSameThread(records: StreamRequestRecord[]) {
  const threadIds = records.map(threadIdFromRecord).filter((threadId): threadId is string => Boolean(threadId));

  expect(threadIds.length).toBeGreaterThanOrEqual(2);
  expect(new Set(threadIds).size).toBe(1);
}

async function assertInitialSurface(page: Page) {
  await expect(await namedPanel(page, /context budget/i)).toBeVisible();
  await expect(await namedPanel(page, /summary of earlier context/i)).toBeVisible();
  await expect(await namedPanel(page, /recent messages/i)).toBeVisible();
  await expect(await namedPanel(page, /summarized messages/i)).toBeVisible();
  await expect(await namedPanel(page, /compaction events/i)).toBeVisible();
  await expect(await namedPanel(page, /assistant answer/i)).toBeVisible();
  await expect(await namedPanel(page, /final state/i)).toBeVisible();
  await expect(await namedPanel(page, /raw stream events/i)).toBeVisible();

  await expect(followUpInput(page)).toBeVisible();
  await expect(newThreadButton(page)).toBeVisible();
  await expect(seedButton(page)).toBeVisible();
  await expect(sendButton(page)).toBeVisible();
  await expect(reloadButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
}

async function assertSeedCompaction(page: Page) {
  const budget = await namedPanel(page, /context budget/i);
  await expect(budget).toBeVisible();
  await waitForPanelText(budget, /context budget/i, /budget|threshold|token|message|recent|retained/i, 60_000);
  await expect(budget).toContainText(/recent|retain|kept|remaining/i);
  await expect(budget).toContainText(/summari|compact|removed|older/i);

  const summary = await namedPanel(page, /summary of earlier context/i);
  await expect(summary).toBeVisible();
  await waitForPanelText(summary, /summary of earlier context/i, /[A-Za-z][\s\S]{40,}/, 90_000);

  const summarized = await namedPanel(page, /summarized messages/i);
  await expect(summarized).toBeVisible();
  await waitForPanelText(summarized, /summarized messages/i, /user|assistant|message|turn|summari/i);
  const summarizedRows = messageRows(summarized);
  if ((await summarizedRows.count()) > 0) {
    await expect(summarizedRows.first()).toBeVisible();
  }

  const recent = await namedPanel(page, /recent messages/i);
  await expect(recent).toBeVisible();
  await waitForPanelText(recent, /recent messages/i, /user|assistant|message|turn|recent/i);
  await expect(recent).toContainText(/recent|retained|kept|latest|user|assistant/i);

  const compactionEvents = await namedPanel(page, /compaction events/i);
  await expect(compactionEvents).toBeVisible();
  await waitForPanelText(compactionEvents, /compaction events/i, /compact|summary|context/i, 90_000);
  await expect(compactionEvents).toContainText(/compact|summary|context/i);

  return summary;
}

async function assertFinalState(page: Page, followUp?: string) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /final state/i, /summary|summary_metadata|summary records/i, 60_000);
  await expect(panel).toContainText(/\bsummary\b/i);
  await expect(panel).toContainText(/summary_metadata|summary metadata/i);
  await expect(panel).toContainText(/summary_records|summary records/i);
  await expect(panel).toContainText(/summarized_messages|summarized messages/i);
  await expect(panel).toContainText(/context_events|context events/i);
  await expect(panel).toContainText(/recent|messages/i);

  if (followUp) {
    await expect(panel).toContainText(followUp);
  }
}

async function assertRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(eventRows(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/\bupdates?\b/i);
  await expect(panel).toContainText(/\bcustom\b/i);
  await expect(panel).toContainText(/compact|summary|context_event|context events|summarized_messages/i);
}

async function assertFollowUpUsedSummary(page: Page, summaryText: string, answerBefore: string) {
  const followUp = `E2E follow-up ${Date.now()}: using only the summarized earlier context, list two preserved facts that answer the latest turn.`;
  const summaryTerms = significantTerms(summaryText);
  expect(summaryTerms.length).toBeGreaterThanOrEqual(2);

  await followUpInput(page).fill(followUp);
  await sendButton(page).click();

  const assistantAnswer = await namedPanel(page, /assistant answer/i);
  await expect(assistantAnswer).toBeVisible();
  await expect
    .poll(async () => panelBodyText(assistantAnswer, /assistant answer/i), { timeout: 120_000 })
    .not.toBe(answerBefore);

  const answerText = await panelBodyText(assistantAnswer, /assistant answer/i);
  expect(answerText.length).toBeGreaterThan(40);

  const sharedTerms = summaryTerms.filter((term) => answerText.toLowerCase().includes(term));
  expect(sharedTerms.length).toBeGreaterThanOrEqual(Math.min(2, summaryTerms.length));

  await assertFinalState(page, followUp);
  return followUp;
}

test("Long Context UI compacts seeded context and answers follow-up from the same thread summary", async ({
  page,
}) => {
  await selectExample(page);
  await assertInitialSurface(page);

  await newThreadButton(page).click();

  const streamRequests = watchStreamRequests(page);

  await seedButton(page).click();

  const summaryPanel = await assertSeedCompaction(page);
  await assertFinalState(page);
  await assertRawEvents(page);

  const assistantAnswer = await namedPanel(page, /assistant answer/i);
  const answerBefore = await panelBodyText(assistantAnswer, /assistant answer/i);
  const summaryText = await panelBodyText(summaryPanel, /summary of earlier context/i);
  expect(summaryText.length).toBeGreaterThan(40);

  await assertFollowUpUsedSummary(page, summaryText, answerBefore);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records);
  assertSameThread(streamRequests.records);
});
