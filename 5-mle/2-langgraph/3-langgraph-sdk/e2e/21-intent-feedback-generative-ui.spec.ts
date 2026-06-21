import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "intent_feedback_generative_ui";
const SELECTED_TICKER = "AAPL";
const SELECTED_MARKET = "NASDAQ";
const SELECTED_PERIOD = "1D";

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

function keyPattern(key: string) {
  return new RegExp(`\\b${escapeRegExp(key).replace("_", "[_ ]")}\\b`, "i");
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

function investorRequestInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Investor request$/i })
    .or(root.getByRole("textbox", { name: /investor request/i }))
    .or(root.getByPlaceholder(/investor request|request|prompt/i))
    .or(root.locator("textarea"))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runIntentButton(page: Page) {
  return actionButton(page, /^Run intent check$/i);
}

function continueButton(page: Page) {
  return actionButton(page, /^Continue with selections$/i);
}

function useAmbiguousRequestButton(page: Page) {
  return actionButton(page, /^Use ambiguous request$/i);
}

function useCompleteRequestButton(page: Page) {
  return actionButton(page, /^Use complete request$/i);
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

  await page
    .getByRole("button", { name: /^21 Intent Feedback with Generative UI(?: implemented)?$/i })
    .click();

  await expect(
    page.getByRole("heading", { name: /^Intent Feedback with Generative UI$/i }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i }).first()).toHaveValue(
    API_URL,
  );
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
  return panel.locator(
    ".event-row, [class*='event' i], details, pre, code, li, tr, article, [data-testid*='event' i]",
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

async function generatedFieldRoot(panel: Locator, fieldName: RegExp, optionName: RegExp) {
  const group = panel.getByRole("group", { name: fieldName }).first();
  if (await isVisible(group)) return group;

  const fieldset = panel.locator("fieldset").filter({ hasText: fieldName }).first();
  if (await isVisible(fieldset)) return fieldset;

  const labeledContainer = panel
    .locator("section, article, div, li")
    .filter({ hasText: fieldName })
    .filter({ hasText: optionName })
    .first();
  if (await isVisible(labeledContainer)) return labeledContainer;

  return panel;
}

async function selectNativeOption(combo: Locator, optionName: RegExp) {
  const options = combo.locator("option");
  const optionCount = await options.count();
  if (optionCount === 0) return false;

  for (let index = 0; index < optionCount; index += 1) {
    const option = options.nth(index);
    const label = normalizeText(await option.innerText());
    const value = await option.getAttribute("value");

    if (optionName.test(label) || (value !== null && optionName.test(value))) {
      if (value !== null) {
        await combo.selectOption({ value });
      } else {
        await combo.selectOption({ label });
      }
      return true;
    }
  }

  return false;
}

async function selectGeneratedChoice(
  page: Page,
  panel: Locator,
  fieldName: RegExp,
  optionName: RegExp,
) {
  const root = await generatedFieldRoot(panel, fieldName, optionName);
  const combo = root.getByRole("combobox", { name: fieldName }).first();
  if (await isVisible(combo)) {
    if (await selectNativeOption(combo, optionName)) return;

    await combo.click();
    const option = page.getByRole("option", { name: optionName }).first();
    await expect(option).toBeVisible();
    await option.click();
    return;
  }

  const radio = root.getByRole("radio", { name: optionName }).first();
  if (await isVisible(radio)) {
    await radio.check();
    return;
  }

  const checkbox = root.getByRole("checkbox", { name: optionName }).first();
  if (await isVisible(checkbox)) {
    await checkbox.check();
    return;
  }

  const button = root.getByRole("button", { name: optionName }).first();
  if (await isVisible(button)) {
    await button.click();
    return;
  }

  const labeledInput = root.getByLabel(optionName).first();
  if (await isVisible(labeledInput)) {
    try {
      await labeledInput.check();
    } catch {
      await labeledInput.click();
    }
    return;
  }

  const textChoice = root.getByText(optionName).first();
  await expect(textChoice).toBeVisible();
  await textChoice.click();
}

async function assertInitialSurface(page: Page) {
  await expect(investorRequestInput(page)).toBeVisible();
  await expect(runIntentButton(page)).toBeVisible();
  await expect(continueButton(page)).toBeVisible();
  await expect(useAmbiguousRequestButton(page)).toBeVisible();
  await expect(useCompleteRequestButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();

  for (const panelName of [
    /intent status/i,
    /generated ui request/i,
    /completed intent/i,
    /quote snapshot/i,
    /intent events/i,
    /final answer/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, panelName)).toBeVisible();
  }
}

async function assertGeneratedControls(page: Page) {
  const panel = await namedPanel(page, /generated ui request/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /generated ui request/i, /ticker|market|period|ui_requests/i, 60_000);

  await expect(panel).toContainText(/ticker/i);
  await expect(panel).toContainText(/market/i);
  await expect(panel).toContainText(/period/i);
  await expect(panel).toContainText(/AAPL|NVDA/i);
  await expect(panel).toContainText(/NASDAQ|NYSE/i);
  await expect(panel).toContainText(/1D|1M/i);

  return panel;
}

async function assertAmbiguousRun(page: Page) {
  const intentStatus = await namedPanel(page, /intent status/i);
  await expect(intentStatus).toBeVisible();
  await waitForPanelText(
    intentStatus,
    /intent status/i,
    /missing|incomplete|ambiguous|needs|ticker|market|period/i,
    60_000,
  );
  await expect(intentStatus).toContainText(/missing|incomplete|ambiguous|needs/i);

  const generatedUi = await assertGeneratedControls(page);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelText(finalState, /final state/i, /missing_fields|ui_requests|intent/i, 60_000);
  for (const key of ["intent", "missing_fields", "ui_requests"]) {
    await expect(finalState).toContainText(keyPattern(key));
  }

  const finalAnswer = await namedPanel(page, /final answer/i);
  await expect(finalAnswer).toBeVisible();
  const finalAnswerText = await panelBodyText(finalAnswer, /final answer/i);
  expect(finalAnswerText).not.toMatch(/\$\s*\d|\d+\.\d+\s*(?:usd|dollars?)?|price\s*[:=]|last\s*[:=]/i);

  await assertRawEvents(page, /ui_requests|missing_fields|generated|intent|custom/i);
  return generatedUi;
}

async function assertIntentEvents(page: Page) {
  const panel = await namedPanel(page, /intent events/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /intent events/i,
    /ui_request|selection|quote|answer|intent|generated|custom/i,
    60_000,
  );
  await expect(eventRows(panel).first()).toBeVisible();
  await expect(panel).toContainText(/ui_request|selection|quote|answer|intent|generated/i);
}

async function assertCompletedRun(page: Page) {
  const completedIntent = await namedPanel(page, /completed intent/i);
  await expect(completedIntent).toBeVisible();
  await waitForPanelText(completedIntent, /completed intent/i, /AAPL|NASDAQ|1D/i, 90_000);
  await expect(completedIntent).toContainText(new RegExp(SELECTED_TICKER, "i"));
  await expect(completedIntent).toContainText(new RegExp(SELECTED_MARKET, "i"));
  await expect(completedIntent).toContainText(new RegExp(SELECTED_PERIOD, "i"));

  const quoteSnapshot = await namedPanel(page, /quote snapshot/i);
  await expect(quoteSnapshot).toBeVisible();
  await waitForPanelText(
    quoteSnapshot,
    /quote snapshot/i,
    /AAPL|price|last|bid|ask|change|open|close|\$\s*\d|\d+\.\d+/i,
    90_000,
  );
  await expect(quoteSnapshot).toContainText(new RegExp(SELECTED_TICKER, "i"));
  await expect(quoteSnapshot).toContainText(/price|last|bid|ask|change|open|close|\$\s*\d|\d+\.\d+/i);

  const finalAnswer = await namedPanel(page, /final answer/i);
  await expect(finalAnswer).toBeVisible();
  await waitForPanelText(finalAnswer, /final answer/i, /[A-Za-z][\s\S]{30,}/, 120_000);
  await expect(finalAnswer).not.toContainText(/no final answer yet|waiting/i);

  await assertIntentEvents(page);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelText(finalState, /final state/i, /quote_snapshot|final_status|intent_events/i, 90_000);
  for (const key of [
    "intent",
    "missing_fields",
    "ui_requests",
    "selection",
    "quote_snapshot",
    "answer",
    "final",
    "intent_events",
    "final_status",
  ]) {
    await expect(finalState).toContainText(keyPattern(key));
  }
  await expect(finalState).toContainText(new RegExp(SELECTED_TICKER, "i"));
  await expect(finalState).toContainText(new RegExp(SELECTED_MARKET, "i"));
  await expect(finalState).toContainText(new RegExp(SELECTED_PERIOD, "i"));
}

async function assertRawEvents(page: Page, payloadPattern: RegExp) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(eventRows(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/\bupdates?\b/i);
  await expect(panel).toContainText(/\bcustom\b/i);
  await expect(panel).toContainText(payloadPattern);
}

test("Intent Feedback with Generative UI exposes the expected controls and panels", async ({
  page,
}) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Intent Feedback with Generative UI completes an ambiguous request through generated selections", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const requestMarker = `E2E intent feedback marker ${uniqueId}`;

  await useAmbiguousRequestButton(page).click();
  await expect
    .poll(async () => investorRequestInput(page).inputValue(), { timeout: 10_000 })
    .toMatch(/[\s\S]{10,}/);

  const seededRequest = await investorRequestInput(page).inputValue();
  await investorRequestInput(page).fill(
    `${seededRequest}\n\n${requestMarker}: keep ticker, market, and period unresolved until I choose them in the generated UI.`,
  );

  const ambiguousRunRequests = watchStreamRequests(page);
  await runIntentButton(page).click();

  const generatedUi = await assertAmbiguousRun(page);

  ambiguousRunRequests.stop();
  assertStreamRequestBodies(ambiguousRunRequests.records, [requestMarker]);

  await selectGeneratedChoice(page, generatedUi, /ticker/i, new RegExp(`^${SELECTED_TICKER}$`, "i"));
  await selectGeneratedChoice(page, generatedUi, /market/i, new RegExp(`^${SELECTED_MARKET}$`, "i"));
  await selectGeneratedChoice(page, generatedUi, /period/i, new RegExp(`^${SELECTED_PERIOD}$`, "i"));

  const continuationRequests = watchStreamRequests(page);
  await continueButton(page).click();

  await assertCompletedRun(page);
  await assertRawEvents(page, /selection|quote_snapshot|answer|final_status|intent_events/i);

  continuationRequests.stop();
  assertStreamRequestBodies(continuationRequests.records, [
    new RegExp(`\\b${SELECTED_TICKER}\\b`, "i"),
    new RegExp(`\\b${SELECTED_MARKET}\\b`, "i"),
    /\b1D\b|one[_ -]?day/i,
  ]);
});
