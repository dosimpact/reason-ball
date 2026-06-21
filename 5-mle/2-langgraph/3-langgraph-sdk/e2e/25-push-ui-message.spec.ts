import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "push_ui_message_example";

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

function pushPromptInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Prompt$/i })
    .or(root.getByRole("textbox", { name: /push ui message prompt|prompt|message/i }))
    .or(root.getByPlaceholder(/push ui message prompt|prompt|message|request/i))
    .or(root.locator("textarea"))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function sampleButtons(page: Page) {
  return workspace(page).getByRole("button", { name: /sample/i });
}

function runPushUiMessageButton(page: Page) {
  return actionButton(page, /^Run push UI message$/i);
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

  await page.getByRole("button", { name: /25\s+push_ui_message Example/i }).click();

  await expect(
    page.getByRole("heading", { name: /^(?:25\s+)?push_ui_message Example$/i }),
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
      ".ui-event",
      ".ui-message-event",
      "[class*='event' i]",
      "[data-testid*='event' i]",
      "[data-testid*='stream' i]",
      "article",
      "details",
      "pre",
      "code",
      "li",
      "tr",
    ].join(", "),
  );
}

function uiMessageCards(panel: Locator) {
  return panel.locator(
    [
      ".ui-message",
      ".ui-card",
      ".status-card",
      ".action-card",
      ".unsupported-ui-message",
      "[data-ui-message-type]",
      "[data-ui-component]",
      "[data-testid*='ui-message' i]",
      "[data-testid*='push-ui' i]",
      "[class*='ui-message' i]",
      "[class*='push-ui' i]",
      "[class*='status' i]",
      "[class*='card' i]",
      "[class*='action' i]",
      "[class*='unsupported' i]",
      "article",
      "details",
      "li",
    ].join(", "),
  );
}

function uiActionControls(panel: Locator) {
  return panel.locator(
    [
      "button",
      "[role='button']",
      "a[href]",
      "[data-action-id]",
      "[data-ui-action]",
      "[data-chip-id]",
      ".chip",
      ".action-chip",
      "[class*='chip' i]",
      "[class*='action' i]",
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

async function chatPanel(page: Page) {
  return namedPanel(page, /chat|conversation|message thread|inline ui messages?|ui messages?/i);
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(pushPromptInput(page)).toBeVisible();
  await expect(runPushUiMessageButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
  await expect.poll(async () => sampleButtons(page).count(), { timeout: 10_000 }).toBeGreaterThan(1);

  for (const panelName of [
    /chat|conversation|message thread|inline ui messages?|ui messages?/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, panelName)).toBeVisible();
  }
}

async function assertInlineUiMessages(page: Page) {
  const panel = await chatPanel(page);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /chat|conversation|message thread|inline ui messages?|ui messages?/i,
    /status|card|action|unsupported|ui|component|payload/i,
    90_000,
  );

  const cards = uiMessageCards(panel);
  await expect.poll(async () => cards.count(), { timeout: 90_000 }).toBeGreaterThanOrEqual(3);
  await expect(cards.filter({ hasText: /status|progress|queued|running|complete|completed/i }).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(cards.filter({ hasText: /card|summary|title|detail|metric|payload/i }).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(cards.filter({ hasText: /action|button|chip|select|approve|open|acknowledge/i }).first()).toBeVisible({
    timeout: 60_000,
  });
}

async function assertUiActionControlsAreClickable(page: Page) {
  const panel = await chatPanel(page);
  const control = uiActionControls(panel)
    .filter({ hasText: /action|select|approve|open|acknowledge|details|chip|continue|dismiss/i })
    .first();

  await expect(control).toBeVisible({ timeout: 60_000 });
  await control.click();
}

async function assertUnsupportedFallback(page: Page) {
  const panel = await chatPanel(page);
  const fallback = uiMessageCards(panel)
    .filter({ hasText: /unsupported|unknown|fallback/i })
    .first();

  await expect(fallback).toBeVisible({ timeout: 90_000 });
  await expect(fallback).toContainText(/unsupported|unknown|fallback/i);
  await expect(fallback).toContainText(/json|payload|component|type|\{|\}/i);
}

async function assertFinalState(page: Page, options: { marker: string }) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /final state/i,
    /ui|ui_render_status|render status|final_status|final/i,
    90_000,
  );

  await expect(panel).toContainText(options.marker);

  for (const pattern of [
    fieldPattern("ui"),
    fieldPattern("ui_render_status", "uiRenderStatus", "ui render status"),
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
  await expect(panel).toContainText(/ui|push_ui_message|message|component|status|card|action|unsupported/i);
}

test("push_ui_message Example exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("push_ui_message Example streams pushed UI messages inline", async ({ page }, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const marker = `E2E push_ui_message marker ${uniqueId}`;

  await sampleButtons(page).first().click();
  await expect
    .poll(async () => pushPromptInput(page).inputValue(), { timeout: 10_000 })
    .toMatch(/[\s\S]{10,}/);

  const seededPrompt = await pushPromptInput(page).inputValue();
  await pushPromptInput(page).fill(
    `${seededPrompt}\n\n${marker}: push status, card, action, and unsupported UI message payloads before final state.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runPushUiMessageButton(page).click();

  await assertInlineUiMessages(page);
  await assertUiActionControlsAreClickable(page);
  await assertUnsupportedFallback(page);
  await assertFinalState(page, { marker });
  await assertRawStreamEvents(page);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records, [marker]);
});
