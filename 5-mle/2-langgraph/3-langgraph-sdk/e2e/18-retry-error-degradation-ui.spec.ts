import { expect, Locator, Page, Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  await page.getByRole("button", { name: /18 Retry \/ Error \/ Degradation UI/i }).click();

  await expect(page.getByRole("heading", { name: /Retry \/ Error \/ Degradation UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    API_URL,
  );
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function queryInput(page: Page) {
  return workspace(page)
    .getByRole("textbox", { name: /^query$/i })
    .or(workspace(page).getByPlaceholder(/query|prompt|request/i))
    .first();
}

function maxAttemptsInput(page: Page) {
  return workspace(page)
    .getByRole("spinbutton", { name: /max attempts/i })
    .or(workspace(page).getByRole("textbox", { name: /max attempts/i }))
    .first();
}

function fallbackCheckbox(page: Page) {
  return workspace(page).getByRole("checkbox", { name: /enable fallback/i }).first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function watchStreamRequests(page: Page) {
  const bodies: string[] = [];
  const handler = (request: Request) => {
    if (request.method() !== "POST" || !request.url().includes("/runs/stream")) return;
    bodies.push(request.postData() ?? "");
  };

  page.on("request", handler);
  return {
    bodies,
    stop: () => page.off("request", handler),
  };
}

function failureModeControl(page: Page, label: string) {
  const labelPattern = new RegExp(`^${escapeRegExp(label)}\\b`, "i");
  return workspace(page)
    .getByRole("radio", { name: labelPattern })
    .or(workspace(page).getByRole("button", { name: labelPattern }))
    .first();
}

function attemptCards(panel: Locator) {
  return panel
    .locator(".retry-attempt-card, article, li, details, [data-testid*='attempt' i]")
    .filter({ hasText: /attempt\s+\d/i });
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
    typeof textOrPattern === "string"
      ? new RegExp(escapeRegExp(textOrPattern))
      : textOrPattern;
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).toMatch(pattern);
}

async function selectFailureMode(page: Page, label: string) {
  const control = failureModeControl(page, label);
  await expect(control).toBeVisible();
  await control.click();

  const selectedRadio = workspace(page)
    .getByRole("radio", { name: new RegExp(`^${escapeRegExp(label)}\\b`, "i") })
    .first();
  if ((await selectedRadio.count()) > 0) {
    await expect(selectedRadio).toBeChecked();
  }
}

async function setFallback(page: Page, enabled: boolean) {
  const checkbox = fallbackCheckbox(page);
  await expect(checkbox).toBeVisible();

  if (enabled) {
    if (!(await checkbox.isChecked())) await checkbox.check();
  } else if (await checkbox.isChecked()) {
    await checkbox.uncheck();
  }
}

async function assertInitialSurface(page: Page) {
  await expect(await namedPanel(page, /run status/i)).toBeVisible();
  await expect(await namedPanel(page, /retry timeline/i)).toBeVisible();
  await expect(await namedPanel(page, /error details/i)).toBeVisible();
  await expect(await namedPanel(page, /fallback result/i)).toBeVisible();
  await expect(await namedPanel(page, /retry events/i)).toBeVisible();
  await expect(await namedPanel(page, /final answer/i)).toBeVisible();
  await expect(await namedPanel(page, /final state/i)).toBeVisible();
  await expect(await namedPanel(page, /raw stream events/i)).toBeVisible();

  await expect(queryInput(page)).toBeVisible();
  await expect(failureModeControl(page, "Normal")).toBeVisible();
  await expect(failureModeControl(page, "Flaky")).toBeVisible();
  await expect(failureModeControl(page, "Fallback")).toBeVisible();
  await expect(failureModeControl(page, "Forced failure")).toBeVisible();
  await expect(maxAttemptsInput(page)).toBeVisible();
  await expect(fallbackCheckbox(page)).toBeVisible();
  await expect(actionButton(page, /^Run retry demo$/i)).toBeVisible();
  await expect(actionButton(page, /^Reset$/i)).toBeVisible();
}

async function runMode(page: Page, label: string, query: string, maxAttempts = 3) {
  const streamRequests = watchStreamRequests(page);
  await selectFailureMode(page, label);
  await queryInput(page).fill(query);
  await maxAttemptsInput(page).fill(String(maxAttempts));

  if (label !== "Forced failure") {
    await setFallback(page, true);
  }

  await actionButton(page, /^Run retry demo$/i).click();
  await expect(page.getByText(/^Run complete$/i).first()).toBeVisible({ timeout: 150_000 });
  streamRequests.stop();
  return streamRequests.bodies;
}

function assertStreamRequestBodies(bodies: string[], failureMode: string) {
  const bodyText = bodies.join("\n");
  expect(bodyText).toContain("retry_error_degradation");
  expect(bodyText).toContain(failureMode);
  expect(bodyText).toMatch(/updates/i);
  expect(bodyText).toMatch(/custom/i);
}

async function assertRunStatus(page: Page, finalStatus: RegExp, strategy: RegExp) {
  const panel = await namedPanel(page, /run status/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /run status/i, finalStatus);
  await expect(panel).toContainText(finalStatus);
  await expect(panel).toContainText(strategy);
  await expect(panel).toContainText(/current attempt/i);
}

async function assertRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 45_000 });
  await expect(panel).toContainText(/\bupdates?\b/i);
  await expect(panel).toContainText(/\bcustom\b/i);
  await expect(panel).toContainText(/retry_status/i);
}

async function assertFinalState(page: Page, options: { query: string; status: RegExp; resultKey: RegExp }) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /final state/i, /final_status/i);
  await expect(panel).toContainText(/attempts/i);
  await expect(panel).toContainText(/errors/i);
  await expect(panel).toContainText(/retry_events/i);
  await expect(panel).toContainText(/final_status/i);
  await expect(panel).toContainText(options.status);
  await expect(panel).toContainText(options.resultKey);
  await expect(panel).toContainText(options.query);
}

async function assertFinalAnswer(page: Page, expected: RegExp) {
  const panel = await namedPanel(page, /final answer/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /final answer/i, /[A-Za-z][\s\S]{20,}/, 45_000);
  await expect(panel).not.toContainText(/no final answer yet/i);
  await expect(panel).toContainText(expected);
}

test("Retry / Error / Degradation UI recovers from flaky transient failures", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const query = `E2E retry flaky query ${uniqueId}: verify transient retries recover on the third attempt.`;

  const streamRequests = await runMode(page, "Flaky", query, 3);
  assertStreamRequestBodies(streamRequests, "flaky_success");

  await assertRunStatus(page, /success_with_retries|success with retries|recovered/i, /primary/i);

  const timeline = await namedPanel(page, /retry timeline/i);
  await expect(timeline).toBeVisible();
  await expect.poll(async () => attemptCards(timeline).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);

  const attemptOne = attemptCards(timeline).filter({ hasText: /attempt\s+1/i }).first();
  const attemptTwo = attemptCards(timeline).filter({ hasText: /attempt\s+2/i }).first();
  const attemptThree = attemptCards(timeline).filter({ hasText: /attempt\s+3/i }).first();
  await expect(attemptOne).toContainText(/retrying|transient|recoverable|backoff/i);
  await expect(attemptOne).toContainText(/100ms|100 ms|backoff/i);
  await expect(attemptTwo).toContainText(/retrying|transient|recoverable|backoff/i);
  await expect(attemptTwo).toContainText(/200ms|200 ms|backoff/i);
  await expect(attemptThree).toContainText(/succeeded|primary call succeeded/i);

  const errors = await namedPanel(page, /error details/i);
  await expect(errors).toBeVisible();
  await expect(errors).toContainText(/TransientError|transient/i);
  await expect(errors).toContainText(/recoverable/i);
  await expect(errors).toContainText(/attempt\s+1/i);
  await expect(errors).toContainText(/attempt\s+2/i);

  const retryEvents = await namedPanel(page, /retry events/i);
  await expect(retryEvents).toBeVisible();
  await expect(retryEvents).toContainText(/primary_call|primary call/i);
  await expect(retryEvents).toContainText(/backoff|waiting/i);
  await expect(retryEvents).toContainText(/succeeded/i);

  const fallback = await namedPanel(page, /fallback result/i);
  await expect(fallback).toBeVisible();
  await waitForPanelText(fallback, /fallback result/i, /[A-Za-z][\s\S]{20,}/);

  await assertFinalAnswer(page, /recovered|primary call|retry/i);
  await assertFinalState(page, {
    query,
    status: /success_with_retries|success with retries/i,
    resultKey: /primary_result/i,
  });
  await assertRawEvents(page);
});

test("Retry / Error / Degradation UI uses fallback after exhausted primary attempts", async ({
  page,
}, testInfo) => {
  await selectExample(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const query = `E2E retry fallback query ${uniqueId}: verify fallback after exhausted primary attempts.`;

  const streamRequests = await runMode(page, "Fallback", query, 3);
  assertStreamRequestBodies(streamRequests, "fallback_success");

  await assertRunStatus(page, /fallback_success|fallback success/i, /fallback/i);

  const timeline = await namedPanel(page, /retry timeline/i);
  await expect(timeline).toBeVisible();
  await expect.poll(async () => attemptCards(timeline).count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  await expect(timeline).toContainText(/attempt\s+1/i);
  await expect(timeline).toContainText(/attempt\s+2/i);
  await expect(timeline).toContainText(/attempt\s+3/i);
  await expect(timeline).toContainText(/retrying|transient|recoverable|backoff/i);

  const errors = await namedPanel(page, /error details/i);
  await expect(errors).toBeVisible();
  await expect(errors).toContainText(/TransientError|transient/i);
  await expect(errors).toContainText(/recoverable/i);
  await expect(errors).toContainText(/attempt\s+3/i);

  const fallback = await namedPanel(page, /fallback result/i);
  await expect(fallback).toBeVisible();
  await waitForPanelText(fallback, /fallback result/i, /[A-Za-z][\s\S]{20,}/);
  await expect(fallback).toContainText(/fallback|cached|partial|degradation|graceful/i);

  const retryEvents = await namedPanel(page, /retry events/i);
  await expect(retryEvents).toBeVisible();
  await expect(retryEvents).toContainText(/fallback/i);
  await expect(retryEvents).toContainText(/succeeded/i);

  await assertFinalAnswer(page, /fallback/i);
  await assertFinalState(page, {
    query,
    status: /fallback_success|fallback success/i,
    resultKey: /fallback_result/i,
  });
  await assertRawEvents(page);
});

test("Retry / Error / Degradation UI exposes permanent forced failures", async ({
  page,
}, testInfo) => {
  await selectExample(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const query = `E2E retry forced failure query ${uniqueId}: verify permanent errors are not hidden.`;

  const streamRequests = await runMode(page, "Forced failure", query, 3);
  assertStreamRequestBodies(streamRequests, "final_failure");

  await assertRunStatus(page, /failed/i, /none/i);

  const timeline = await namedPanel(page, /retry timeline/i);
  await expect(timeline).toBeVisible();
  await expect(timeline).toContainText(/attempt\s+1/i);
  await expect(timeline).toContainText(/failed|PermanentError|permanent/i);

  const errors = await namedPanel(page, /error details/i);
  await expect(errors).toBeVisible();
  await expect(errors).toContainText(/PermanentError|permanent/i);
  await expect(errors).toContainText(/not recoverable|recoverable/i);

  await assertFinalAnswer(page, /final failure|no fallback|failed/i);
  await assertFinalState(page, {
    query,
    status: /\bfailed\b/i,
    resultKey: /final|errors/i,
  });
  await assertRawEvents(page);
});
