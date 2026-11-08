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
  await page.getByRole("button", { name: /14 Plan-and-Execute UI/i }).click();

  await expect(page.getByRole("heading", { name: /Plan-and-Execute UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function taskInput(page: Page) {
  return workspace(page)
    .getByRole("textbox", { name: /task|request|goal|prompt|input|objective/i })
    .or(workspace(page).getByPlaceholder(/task|request|goal|prompt|objective/i))
    .first();
}

function sampleButtons(page: Page) {
  return workspace(page)
    .getByRole("button", {
      name: /sample|task|plan|research|compare|summarize|schedule|trip|launch|analyze/i,
    })
    .filter({ hasNotText: /run|reset|clear|stop|replan/i });
}

function runButton(page: Page) {
  return workspace(page)
    .getByRole("button", {
      name: /run\s+plan|start\s+plan|plan\s+and\s+execute|run\s+task|execute\s+plan/i,
    })
    .first();
}

function stepCards(planPanel: Locator) {
  return planPanel
    .locator(
      ".step-card, .plan-step, [data-testid*='step' i], [data-step-id], article, li, details",
    )
    .filter({
      hasText: /step|pending|active|running|executing|done|completed|failed|error|result/i,
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

async function controlSurface(page: Page) {
  const panel = await namedPanel(page, /replan\s*\/\s*stop controls|control state|run mode/i);
  const hasPanel = (await panel.count()) > 0;
  const modeControls = workspace(page)
    .getByRole("radio", { name: /normal|replan|stop/i })
    .or(workspace(page).getByRole("combobox", { name: /run mode|control mode|mode/i }))
    .or(workspace(page).getByRole("button", { name: /^normal$|^replan$|^stop$/i }))
    .or(workspace(page).getByRole("checkbox", { name: /replan|stop/i }))
    .or(workspace(page).getByLabel(/run mode|control mode|normal|replan|stop/i));

  return { panel, hasPanel, modeControls };
}

async function assertControlSurfaceBeforeRun(page: Page) {
  const { panel, hasPanel, modeControls } = await controlSurface(page);

  if ((await modeControls.count()) > 0) {
    await expect(modeControls.first()).toBeVisible();
    await expect(workspace(page)).toContainText(/normal|replan|stop/i);
    return;
  }

  if (hasPanel) {
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/control|mode|normal|replan|stop/i);
  }
}

async function assertControlSurfaceDuringOrAfterRun(page: Page) {
  const { panel, hasPanel, modeControls } = await controlSurface(page);

  if ((await modeControls.count()) > 0) {
    const firstControl = modeControls.first();
    await expect(firstControl).toBeVisible();

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (await page.getByText(/^Run complete$/i).first().isVisible()) return;
      if (await firstControl.isDisabled()) return;
      await page.waitForTimeout(250);
    }

    if (hasPanel) {
      await expect(panel).toBeVisible();
      await expect(panel).toContainText(/control_mode|control mode|mode|normal|replan|stop/i);
      return;
    }

    await expect(firstControl).toBeDisabled();
  }

  if (hasPanel) {
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/control_mode|control mode|mode|normal|replan|stop/i);
  }
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(panel).toContainText(/updates?|values?|custom|payload|state/i);
  await expect(panel).toContainText(/planner|plan_steps|plan steps|plan/i);
  await expect(panel).toContainText(/executor|completed_steps|completed steps|execute|step/i);
  await expect(panel).toContainText(/finalize|final|answer/i);
  return panel;
}

async function waitForInitialPlanBeforeCompletion(page: Page, planPanel: Locator, steps: Locator) {
  await expect(planPanel).toBeVisible({ timeout: 45_000 });

  await expect
    .poll(
      async () => {
        const count = await steps.count();
        if (count >= 2) return "planned";
        if (await page.getByText(/^Run complete$/i).first().isVisible()) return "complete-before-plan";
        return "waiting";
      },
      { timeout: 45_000 },
    )
    .toBe("planned");
}

test("Plan-and-Execute UI streams a plan, executes steps, and exposes final state", async ({
  page,
}) => {
  await selectExample(page);

  const task = taskInput(page);
  await expect(task).toBeVisible();
  await expect(task).not.toHaveValue("");

  await expect(sampleButtons(page).first()).toBeVisible();
  await assertControlSurfaceBeforeRun(page);

  await runButton(page).click();
  await assertControlSurfaceDuringOrAfterRun(page);

  const planSteps = await namedPanel(page, /plan steps/i);
  const steps = stepCards(planSteps);
  await waitForInitialPlanBeforeCompletion(page, planSteps, steps);

  const executionStatus = await namedPanel(page, /execution status/i);
  await expect(executionStatus).toBeVisible();
  await expect(executionStatus).toContainText(/plan|planner|execute|executor|complete|final/i);

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 90_000 });

  await expect.poll(async () => steps.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await expect(steps.first()).toContainText(/step|id|#|\d/i);
  await expect(steps.first()).toContainText(/title|task|description|goal|[A-Za-z]{4,}/i);
  await expect(planSteps).toContainText(/pending|active|running|executing|done|completed|failed|error/i);
  await expect(planSteps).toContainText(/done|completed/i);
  await expect(planSteps).toContainText(/result|output|answer|error/i);

  const executorOutput = await namedPanel(page, /executor output|completed steps/i);
  await expect(executorOutput).toBeVisible();
  await waitForPanelBodyText(executorOutput, /executor output|completed steps/i, 20_000);
  await expect(executorOutput).toContainText(/step|completed|result|output|executor/i);

  const controlState = await namedPanel(page, /replan\s*\/\s*stop controls|control state|run mode/i);
  if ((await controlState.count()) > 0) {
    await expect(controlState).toBeVisible();
    await expect(controlState).toContainText(/control_mode|control mode|mode|normal|replan|stop/i);
  }

  const finalAnswer = await namedPanel(page, /final answer/i);
  await expect(finalAnswer).toBeVisible();
  const finalAnswerText = await waitForPanelBodyText(finalAnswer, /final answer/i, 30_000);
  expect(finalAnswerText.length).toBeGreaterThan(30);
  expect(finalAnswerText).toMatch(/step|completed|plan|result|summary|final|answer/i);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelBodyText(finalState, /final state/i);
  await expect(finalState).toContainText(/plan_steps|plan steps/i);
  await expect(finalState).toContainText(/completed_steps|completed steps/i);
  await expect(finalState).toContainText(/remaining_steps|remaining steps/i);
  await expect(finalState).toContainText(/control_mode|control mode/i);

  await populatedRawEvents(page);
});
