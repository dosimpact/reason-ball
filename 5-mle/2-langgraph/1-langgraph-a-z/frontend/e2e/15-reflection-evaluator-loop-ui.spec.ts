import { expect, Locator, Page, test } from "@playwright/test";

test.setTimeout(120_000);

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
  await page.getByRole("button", { name: /15 Reflection\s*\/\s*Evaluator Loop UI/i }).click();

  await expect(
    page.getByRole("heading", { name: /Reflection\s*\/\s*Evaluator Loop UI/i }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function promptInput(page: Page) {
  return workspace(page)
    .getByRole("textbox", { name: /prompt|request|task|draft|input|question|goal/i })
    .or(workspace(page).getByPlaceholder(/prompt|request|task|draft|input|question|goal/i))
    .first();
}

function maxAttemptsControl(page: Page) {
  return workspace(page)
    .getByRole("spinbutton", { name: /max attempts|max retries|attempts|retries|iterations/i })
    .or(workspace(page).getByRole("slider", { name: /max attempts|max retries|attempts|retries|iterations/i }))
    .or(
      workspace(page).getByRole("combobox", {
        name: /max attempts|max retries|attempts|retries|iterations/i,
      }),
    )
    .or(
      workspace(page).getByRole("button", {
        name: /max attempts|max retries|attempts|retries|iterations|2|3|4|5/i,
      }),
    )
    .or(workspace(page).getByLabel(/max attempts|max retries|attempts|retries|iterations/i))
    .first();
}

function runButton(page: Page) {
  return workspace(page)
    .getByRole("button", {
      name: /run\s+reflection\s+loop|run\s+evaluator\s+loop|start\s+reflection|run\s+loop|reflect/i,
    })
    .first();
}

function iterationCards(panel: Locator) {
  return panel
    .locator(
      ".iteration-card, .loop-iteration, [data-testid*='iteration' i], [data-iteration], article, li, details",
    )
    .filter({
      hasText: /iteration|attempt|draft|verdict|score|feedback|fail|pass|retry|reflect/i,
    });
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(/waiting|no .* yet|run .* to .*|empty|not available/gi, ""),
  );
}

async function waitForPanelBodyText(panel: Locator, title: RegExp, timeout = 20_000) {
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).not.toBe("");
  return panelBodyText(panel, title);
}

async function assertMaxAttemptsControl(page: Page) {
  const control = maxAttemptsControl(page);
  await expect(control).toBeVisible();

  const rawValue = await control.inputValue().catch(() => "");
  if (rawValue) {
    expect(Number(rawValue)).toBeGreaterThanOrEqual(2);
    return;
  }

  await expect(workspace(page)).toContainText(/max attempts|max retries|attempts|retries|iterations/i);
  await expect(workspace(page)).toContainText(/\b[2-9]\b/);
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(panel).toContainText(/updates?/i);
  await expect(panel).toContainText(/custom/i);
  await expect(panel).toContainText(/draft/i);
  await expect(panel).toContainText(/evaluate|evaluator|feedback|verdict|score/i);
  await expect(panel).toContainText(/finalize|final/i);
  return panel;
}

test("Reflection / Evaluator Loop UI preserves rejected drafts and exposes final loop state", async ({
  page,
}) => {
  await selectExample(page);

  const prompt = promptInput(page);
  await expect(prompt).toBeVisible();
  await expect(prompt).not.toHaveValue("");
  await assertMaxAttemptsControl(page);

  await runButton(page).click();

  const iterationHistory = await namedPanel(page, /iteration history/i);
  const iterations = iterationCards(iterationHistory);
  await expect(iterationHistory).toBeVisible({ timeout: 45_000 });
  await expect.poll(async () => iterations.count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(2);

  const loopStatus = await namedPanel(page, /loop status/i);
  await expect(loopStatus).toBeVisible();
  await expect(loopStatus).toContainText(/iteration|attempt|current|max|score|verdict|status/i);

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 90_000 });

  await expect.poll(async () => iterations.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  const firstIteration = iterations.first();
  const lastIteration = iterations.last();

  await expect(firstIteration).toBeVisible();
  await expect(firstIteration).toContainText(/iteration|attempt|#|\b1\b/i);
  await expect(firstIteration).toContainText(/draft/i);
  await expect(iterationHistory).toContainText(/score/i);
  await expect(iterationHistory).toContainText(/verdict/i);
  await expect(iterationHistory).toContainText(/feedback|critique|reason/i);
  await expect(firstIteration).toContainText(/fail|failed|reject|rejected|retry|revise|below|insufficient/i);

  await expect(lastIteration).toBeVisible();
  await expect(lastIteration).toContainText(/iteration|attempt|draft|score|verdict|feedback|final/i);
  await expect(lastIteration).toContainText(/pass|passed|final|max|stop|accepted|complete/i);

  await expect(iterationHistory).toContainText(/fail|failed|reject|rejected|retry|revise/i);
  await expect(iterationHistory).toContainText(/pass|passed|final|max attempts|max-attempt|stop reason|accepted/i);

  const draftComparison = await namedPanel(page, /draft comparison/i);
  await expect(draftComparison).toBeVisible();
  await waitForPanelBodyText(draftComparison, /draft comparison/i, 20_000);
  await expect(draftComparison).toContainText(/rejected|initial|previous|before|draft/i);
  await expect(draftComparison).toContainText(/final|accepted|after|revised|improved/i);

  const evaluatorFeedback = await namedPanel(page, /evaluator feedback/i);
  await expect(evaluatorFeedback).toBeVisible();
  await waitForPanelBodyText(evaluatorFeedback, /evaluator feedback/i, 20_000);
  await expect(evaluatorFeedback).toContainText(/feedback|critique|reason|improve|rubric|score|verdict/i);
  await expect(evaluatorFeedback).toContainText(/fail|pass|reject|retry|accepted|score|verdict/i);

  const finalAnswer = await namedPanel(page, /final answer/i);
  await expect(finalAnswer).toBeVisible();
  const finalAnswerText = await waitForPanelBodyText(finalAnswer, /final answer/i, 30_000);
  expect(finalAnswerText.length).toBeGreaterThan(30);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelBodyText(finalState, /final state/i);
  await expect(finalState).toContainText(/iterations/i);
  await expect(finalState).toContainText(/stop_reason|stop reason/i);
  await expect(finalState).toContainText(/current_iteration|current iteration/i);
  await expect(finalState).toContainText(/verdict/i);
  await expect(finalState).toContainText(/score|feedback|final|answer/i);

  await populatedRawEvents(page);
});
