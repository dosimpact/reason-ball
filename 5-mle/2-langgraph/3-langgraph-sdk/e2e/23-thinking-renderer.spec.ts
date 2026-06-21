import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "thinking_renderer";
const FORBIDDEN_REASONING_PHRASES = [
  "hidden chain-of-thought",
  "private reasoning",
  "internal reasoning transcript",
  "step-by-step hidden reasoning",
];

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

function thinkingPromptInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Thinking prompt$/i })
    .or(root.getByRole("textbox", { name: /thinking prompt|prompt|question/i }))
    .or(root.getByPlaceholder(/thinking prompt|prompt|question|request/i))
    .or(root.locator("textarea"))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function useAnalysisSampleButton(page: Page) {
  return actionButton(page, /^Use analysis sample$/i);
}

function useSupportSampleButton(page: Page) {
  return actionButton(page, /^Use support sample$/i);
}

function runThinkingRendererButton(page: Page) {
  return actionButton(page, /^Run thinking renderer$/i);
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

  await page.getByRole("button", { name: /^23 Thinking Renderer(?: implemented)?$/i }).click();

  await expect(page.getByRole("heading", { name: /^(?:23\s+)?Thinking Renderer$/i })).toBeVisible();
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
      ".thinking-event",
      ".thinking-step",
      ".timeline-item",
      "[class*='event' i]",
      "[class*='thinking' i]",
      "[class*='timeline' i]",
      "[class*='card' i]",
      "[data-testid*='event' i]",
      "[data-testid*='thinking' i]",
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
  await expect(thinkingPromptInput(page)).toBeVisible();
  await expect(useAnalysisSampleButton(page)).toBeVisible();
  await expect(useSupportSampleButton(page)).toBeVisible();
  await expect(runThinkingRendererButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();

  for (const panelName of [
    /thinking status/i,
    /thinking timeline/i,
    /public reasoning summary/i,
    /safety guardrails/i,
    /final answer/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, panelName)).toBeVisible();
  }
}

async function waitForThinkingSignalBeforeFinalAnswer(page: Page) {
  const thinkingPanels = [
    { panel: await namedPanel(page, /thinking status/i), title: /thinking status/i },
    { panel: await namedPanel(page, /thinking timeline/i), title: /thinking timeline/i },
    {
      panel: await namedPanel(page, /public reasoning summary/i),
      title: /public reasoning summary/i,
    },
  ];
  const finalAnswer = await namedPanel(page, /final answer/i);

  await expect
    .poll(
      async () => {
        const thinkingText = await combinedPanelBodyText(thinkingPanels);
        const finalText = await panelBodyText(finalAnswer, /final answer/i);
        const hasThinkingSignal =
          /thinking|reasoning|summary|status|step|timeline|analysis|support|custom|running|guardrail/i.test(
            thinkingText,
          );
        const hasFinalAnswer =
          /[A-Za-z][\s\S]{30,}/.test(finalText) &&
          !/no final answer yet|waiting|run .* to/i.test(finalText);

        if (hasThinkingSignal) return "thinking";
        if (hasFinalAnswer) return "final-answer";
        return "pending";
      },
      { timeout: 90_000 },
    )
    .toBe("thinking");
}

async function assertThinkingStatus(page: Page) {
  const panel = await namedPanel(page, /thinking status/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /thinking status/i,
    /thinking|reasoning|status|queued|running|streaming|complete|completed|final|done/i,
    60_000,
  );
}

async function assertThinkingTimeline(page: Page) {
  const panel = await namedPanel(page, /thinking timeline/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /thinking timeline/i,
    /thinking|reasoning|summary|step|status|timeline|analysis|support|custom/i,
    60_000,
  );
  await expect(eventCards(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/thinking|reasoning|summary|step|status/i);
}

async function assertPublicReasoningSummary(page: Page) {
  const panel = await namedPanel(page, /public reasoning summary/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /public reasoning summary/i,
    /reasoning|summary|public|analysis|status|step|conclusion/i,
    90_000,
  );
  await expect(panel).toContainText(/reasoning|summary|public|analysis|status/i);
}

async function assertSafetyGuardrails(page: Page) {
  const panel = await namedPanel(page, /safety guardrails/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /safety guardrails/i,
    /guardrail|public|summary|not exposed|not shown|not displayed|not surfaced|not revealed|private|hidden/i,
    60_000,
  );
  await expect(panel).toContainText(/guardrail|public|summary|not exposed|not shown|not displayed|not surfaced|not revealed/i);
}

async function collapsibleThinkingControlCount(panels: Locator[]) {
  let count = 0;
  for (const panel of panels) {
    count += await panel.locator("details").count();
    count += await panel.locator("summary").count();
    count += await panel.locator("button[aria-expanded]").count();
    count += await panel.locator("[role='button'][aria-expanded]").count();
  }
  return count;
}

async function assertCollapsibleThinkingDetails(page: Page) {
  const panels = [
    await namedPanel(page, /thinking timeline/i),
    await namedPanel(page, /public reasoning summary/i),
  ];

  await expect
    .poll(async () => collapsibleThinkingControlCount(panels), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(1);
}

async function assertFinalAnswer(page: Page) {
  const panel = await namedPanel(page, /final answer/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /final answer/i, /[A-Za-z][\s\S]{30,}/, 120_000);
  await expect(panel).not.toContainText(/no final answer yet|waiting/i);

  const finalAnswerText = await panelBodyText(panel, /final answer/i);
  expect(finalAnswerText).not.toMatch(
    /thinking_steps|reasoning_summary|safety_guardrails|final_status|raw stream events|\bupdates?\b|\bcustom\b/i,
  );
}

async function assertFinalState(page: Page, options: { marker: string }) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /final state/i,
    /question|thinking|reasoning|guardrail|answer|final_status|final/i,
    90_000,
  );

  await expect(panel).toContainText(options.marker);

  for (const pattern of [
    fieldPattern("question"),
    fieldPattern("thinking_steps", "thinkingSteps", "thinking steps"),
    fieldPattern("reasoning_summary", "reasoningSummary", "reasoning summary"),
    fieldPattern("safety_guardrails", "safetyGuardrails", "safety guardrails"),
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
  await expect(panel).toContainText(/thinking|reasoning|summary|status|guardrail|answer|final/i);
}

function sentenceAround(text: string, index: number) {
  const startCandidates = [text.lastIndexOf(".", index), text.lastIndexOf("!", index), text.lastIndexOf("?", index), text.lastIndexOf("\n", index)];
  const start = Math.max(...startCandidates) + 1;
  const endCandidates = [
    text.indexOf(".", index),
    text.indexOf("!", index),
    text.indexOf("?", index),
    text.indexOf("\n", index),
  ].filter((candidate) => candidate >= 0);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) + 1 : text.length;

  return normalizeText(text.slice(start, end));
}

function isAllowedGuardrailSentence(label: string, sentence: string) {
  return (
    (/guardrail/i.test(label) || /guardrail/i.test(sentence)) &&
    /\b(?:not|never|without|no|does not|do not|isn't|aren't)\b/i.test(sentence) &&
    /expos|show|display|surface|reveal|include/i.test(sentence)
  );
}

function assertNoForbiddenReasoningDisclosure(label: string, text: string) {
  const lowerText = text.toLowerCase();

  for (const phrase of FORBIDDEN_REASONING_PHRASES) {
    let index = lowerText.indexOf(phrase);
    while (index >= 0) {
      const sentence = sentenceAround(text, index);
      expect(
        isAllowedGuardrailSentence(label, sentence),
        `${label} contains "${phrase}" outside an explicit guardrail non-disclosure sentence: ${sentence}`,
      ).toBe(true);
      index = lowerText.indexOf(phrase, index + phrase.length);
    }
  }
}

async function assertHiddenReasoningSafety(page: Page) {
  const panels = [
    { label: "Thinking Status", panel: await namedPanel(page, /thinking status/i) },
    { label: "Thinking Timeline", panel: await namedPanel(page, /thinking timeline/i) },
    { label: "Public Reasoning Summary", panel: await namedPanel(page, /public reasoning summary/i) },
    { label: "Safety Guardrails", panel: await namedPanel(page, /safety guardrails/i) },
    { label: "Final Answer", panel: await namedPanel(page, /final answer/i) },
  ];

  for (const { label, panel } of panels) {
    assertNoForbiddenReasoningDisclosure(label, await panel.innerText());
  }
}

test("Thinking Renderer exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Thinking Renderer streams public thinking details separately from the final answer", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const marker = `E2E thinking renderer marker ${uniqueId}`;

  await useAnalysisSampleButton(page).click();
  await expect
    .poll(async () => thinkingPromptInput(page).inputValue(), { timeout: 10_000 })
    .toMatch(/\S{10,}/);

  const seededPrompt = await thinkingPromptInput(page).inputValue();
  await thinkingPromptInput(page).fill(
    `${seededPrompt}\n\n${marker}: stream public thinking status and reasoning summary before the final answer.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runThinkingRendererButton(page).click();

  await waitForThinkingSignalBeforeFinalAnswer(page);
  await assertThinkingStatus(page);
  await assertThinkingTimeline(page);
  await assertPublicReasoningSummary(page);
  await assertSafetyGuardrails(page);
  await assertCollapsibleThinkingDetails(page);
  await assertFinalAnswer(page);
  await assertFinalState(page, { marker });
  await assertRawStreamEvents(page);
  await assertHiddenReasoningSafety(page);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records, [marker]);
});
