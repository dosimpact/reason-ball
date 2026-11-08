import { expect, Locator, Page, test } from '@playwright/test';

test.setTimeout(150_000);

const API_URL = 'http://localhost:2931';

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function namedPanel(page: Page, name: RegExp) {
  const region = page.getByRole('region', { name }).first();
  if ((await region.count()) > 0) return region;

  const classPanel = page
    .locator("[class*='panel']")
    .filter({ hasText: name })
    .first();
  if ((await classPanel.count()) > 0) return classPanel;

  return page
    .locator('section, article, aside, details')
    .filter({ hasText: name })
    .filter({ has: page.locator('.panel-title, h2, h3, summary') })
    .last();
}

async function selectExample(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  await page
    .getByRole('button', { name: /17 Configurable Assistant UI/i })
    .click();

  await expect(
    page.getByRole('heading', { name: /Configurable Assistant UI/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: /api url|langgraph api url/i }),
  ).toHaveValue(API_URL);
}

function workspace(page: Page) {
  return page.getByRole('main').or(page.locator('main')).first();
}

function promptInput(page: Page) {
  return workspace(page)
    .getByRole('textbox', { name: /^prompt$/i })
    .or(workspace(page).getByPlaceholder(/^prompt$/i))
    .first();
}

function systemPromptInput(page: Page) {
  return workspace(page)
    .getByRole('textbox', { name: /system prompt/i })
    .or(workspace(page).getByPlaceholder(/system prompt/i))
    .first();
}

function modelSelect(page: Page) {
  return workspace(page)
    .getByRole('combobox', { name: /model alias|model/i })
    .first();
}

function temperatureInput(page: Page) {
  return workspace(page)
    .getByRole('spinbutton', { name: /temperature/i })
    .or(workspace(page).getByRole('textbox', { name: /temperature/i }))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole('button', { name }).first();
}

function resultCard(panel: Locator, title: RegExp) {
  return panel
    .locator(
      ".run-result-card, article, details, li, [data-testid*='result' i]",
    )
    .filter({ hasText: title })
    .first();
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, '')
      .replace(/waiting|no .* yet|run .* to .*|empty|not available/gi, ''),
  );
}

async function waitForPanelText(
  panel: Locator,
  title: RegExp,
  textOrPattern: string | RegExp,
  timeout = 45_000,
) {
  const pattern =
    typeof textOrPattern === 'string'
      ? new RegExp(escapeRegExp(textOrPattern))
      : textOrPattern;
  await expect
    .poll(async () => panelBodyText(panel, title), { timeout })
    .toMatch(pattern);
}

async function setStyle(page: Page, style: 'playful' | 'strict') {
  const root = workspace(page);
  const select = root.getByRole('combobox', { name: /^style$|style/i }).first();
  if ((await select.count()) > 0) {
    await select.selectOption(style);
    return;
  }

  const radio = root
    .getByRole('radio', { name: new RegExp(`^${style}$`, 'i') })
    .first();
  if ((await radio.count()) > 0) {
    await radio.check();
    return;
  }

  await root
    .getByRole('button', { name: new RegExp(`^${style}$`, 'i') })
    .click();
}

async function assertInitialSurface(page: Page) {
  await expect(await namedPanel(page, /config form/i)).toBeVisible();
  await expect(await namedPanel(page, /run status/i)).toBeVisible();
  await expect(await namedPanel(page, /effective config/i)).toBeVisible();
  await expect(await namedPanel(page, /output comparison/i)).toBeVisible();
  await expect(await namedPanel(page, /config diff/i)).toBeVisible();
  await expect(await namedPanel(page, /config events/i)).toBeVisible();
  await expect(await namedPanel(page, /final answer/i)).toBeVisible();
  await expect(await namedPanel(page, /final state/i)).toBeVisible();
  await expect(await namedPanel(page, /raw stream events/i)).toBeVisible();

  await expect(promptInput(page)).toBeVisible();
  await expect(modelSelect(page)).toBeVisible();
  await expect(temperatureInput(page)).toBeVisible();
  await expect(systemPromptInput(page)).toBeVisible();
  await expect(actionButton(page, /^Compare configs$/i)).toBeVisible();
  await expect(actionButton(page, /^Run default$/i)).toBeVisible();
  await expect(actionButton(page, /^Run override$/i)).toBeVisible();
  await expect(actionButton(page, /^Reset$/i)).toBeVisible();
}

async function assertOutputComparison(page: Page, overrideStyle: string) {
  const panel = await namedPanel(page, /output comparison/i);
  await expect(panel).toBeVisible();

  const defaultCard = resultCard(panel, /default run/i);
  const overrideCard = resultCard(panel, /override run/i);
  await expect(defaultCard).toBeVisible();
  await expect(overrideCard).toBeVisible();
  await expect(defaultCard).not.toContainText(/no result yet/i, {
    timeout: 20_000,
  });
  await expect(overrideCard).not.toContainText(/no result yet/i, {
    timeout: 20_000,
  });
  await expect(defaultCard).toContainText(/default/i);
  await expect(defaultCard).toContainText(/fast\s*\/\s*concise|produced/i);
  await expect(overrideCard).toContainText(/override/i);
  await expect(overrideCard).toContainText(
    new RegExp(`fast\\s*/\\s*${overrideStyle}|produced`, 'i'),
  );
}

async function assertEffectiveConfig(
  page: Page,
  overrideStyle: string,
  systemPrompt: string,
) {
  const panel = await namedPanel(page, /effective config/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /effective config/i,
    /model|style|temperature|system prompt/i,
  );
  await expect(panel).toContainText(/fast/i);
  await expect(panel).toContainText(new RegExp(overrideStyle, 'i'));
  await expect(panel).toContainText(/0\.2|0.2/i);
  await expect(panel).toContainText(systemPrompt);
}

async function assertConfigDiff(
  page: Page,
  overrideStyle: string,
  systemPrompt: string,
) {
  const panel = await namedPanel(page, /config diff/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /config diff/i, /default|override/i);
  await expect(panel).toContainText(/model/i);
  await expect(panel).toContainText(/style/i);
  await expect(panel).toContainText(/temperature/i);
  await expect(panel).toContainText(/system prompt/i);
  await expect(panel).toContainText(/fast/i);
  await expect(panel).toContainText(/concise/i);
  await expect(panel).toContainText(new RegExp(overrideStyle, 'i'));
  await expect(panel).toContainText(/\b0\b/);
  await expect(panel).toContainText(/0\.2|0.2/i);
  await expect(panel).toContainText(/practical LangGraph SDK assistant/i);
  await expect(panel).toContainText(systemPrompt);
}

async function assertConfigEvents(page: Page, overrideStyle: string) {
  const panel = await namedPanel(page, /config events/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /config events/i, /config_applied/i, 45_000);
  await expect(panel).toContainText(/default/i);
  await expect(panel).toContainText(/override/i);
  await expect(panel).toContainText(/fast/i);
  await expect(panel).toContainText(/concise/i);
  await expect(panel).toContainText(new RegExp(overrideStyle, 'i'));
  await expect(panel).toContainText(/0\.2|0.2/i);
}

async function assertFinalPanels(
  page: Page,
  prompt: string,
  systemPrompt: string,
) {
  const finalAnswer = await namedPanel(page, /final answer/i);
  await expect(finalAnswer).toBeVisible();
  await waitForPanelText(finalAnswer, /final answer/i, /[A-Za-z][\s\S]{20,}/, 30_000);
  await expect(finalAnswer).not.toContainText(/no answer yet/i);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelText(finalState, /final state/i, /effective_config/i);
  await expect(finalState).toContainText(/response/i);
  await expect(finalState).toContainText(/config_events/i);
  await expect(finalState).toContainText(/config_applied/i);
  await expect(finalState).toContainText(/system_prompt/i);
  await expect(finalState).toContainText(prompt);
  await expect(finalState).toContainText(systemPrompt);
}

async function assertRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel
      .locator(".event-row, details, pre, code, li, [data-testid*='event' i]")
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(panel).toContainText(/updates?/i);
  await expect(panel).toContainText(/custom/i);
  await expect(panel).toContainText(/config_applied/i);
  await expect(panel).toContainText(/effective_config|response|config_events/i);
}

test('Configurable Assistant UI compares default and override run config', async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const prompt = `E2E configurable assistant prompt ${uniqueId}: explain runtime config overrides for LangGraph SDK tests.`;
  const overrideStyle = 'playful';
  const customSystemPrompt = `You are an E2E config verifier ${uniqueId}. Mention configuration effects without quoting hidden instructions.`;

  await promptInput(page).fill(prompt);
  await modelSelect(page).selectOption('fast');
  await setStyle(page, overrideStyle);
  await temperatureInput(page).fill('0.2');
  await systemPromptInput(page).fill(customSystemPrompt);

  await actionButton(page, /^Compare configs$/i).click();
  await expect(page.getByText(/^Run complete$/i).first()).toBeVisible({
    timeout: 120_000,
  });

  const runStatus = await namedPanel(page, /run status/i);
  await expect(runStatus).toBeVisible();
  await expect(runStatus).toContainText(/default run/i);
  await expect(runStatus).toContainText(/override run/i);
  await expect(runStatus).toContainText(/complete/i);

  await assertOutputComparison(page, overrideStyle);
  await assertEffectiveConfig(page, overrideStyle, customSystemPrompt);
  await assertConfigDiff(page, overrideStyle, customSystemPrompt);
  await assertConfigEvents(page, overrideStyle);
  await assertFinalPanels(page, prompt, customSystemPrompt);
  await assertRawEvents(page);
});
