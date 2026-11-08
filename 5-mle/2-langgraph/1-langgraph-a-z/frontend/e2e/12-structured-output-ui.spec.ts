import { expect, Locator, Page, test } from "@playwright/test";

test.setTimeout(90_000);

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
  await page.getByRole("button", { name: /12 Structured Output UI/i }).click();

  await expect(page.getByRole("heading", { name: /Structured Output UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function requestInput(page: Page) {
  return page
    .getByRole("textbox", { name: /request|prompt|input|source|sample|text|content/i })
    .or(page.getByPlaceholder(/request|prompt|input|source|sample|text|content/i))
    .first();
}

function sampleButtons(page: Page) {
  return page
    .getByRole("button", {
      name: /sample|use sample|invoice|receipt|support|incident|lead|profile|extract|contract/i,
    })
    .filter({ hasNotText: /run|reset|clear/i });
}

function runButton(page: Page) {
  return page
    .getByRole("button", {
      name: /run\s+structured\s+extraction|run\s+structured\s+output|extract\s+structured|run\s+extraction/i,
    })
    .first();
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(/waiting|no .* yet|run .* to .*|empty|not available/gi, ""),
  );
}

async function waitForPanelBodyText(panel: Locator, title: RegExp, timeout = 15_000) {
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).not.toBe("");
  return panelBodyText(panel, title);
}

function fieldRows(panel: Locator) {
  return panel
    .locator(
      "tbody tr, .field-row, [data-testid*='field-row' i], [data-testid*='extracted-field' i], li, dl > div",
    )
    .filter({ hasText: /\S/ });
}

async function assertPopulatedFieldTable(panel: Locator) {
  const rows = fieldRows(panel);
  const rowCount = await rows.count();

  if (rowCount > 0) {
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toContainText(/[A-Za-z0-9]/);
    return;
  }

  await expect.poll(async () => panelBodyText(panel, /field table/i), { timeout: 15_000 }).not.toBe(
    "",
  );
  await expect(panel).toContainText(/field|value|type|name|extracted/i);
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(panel).toContainText(/\bupdates?\b/i);
  await expect(panel).toContainText(/payload|schema|validation|parsed|structured|result|state/i);
  return panel;
}

test("Structured Output UI renders validated fields, raw JSON, and stream updates", async ({
  page,
}) => {
  await selectExample(page);

  const request = requestInput(page);
  await expect(request).toBeVisible();
  await expect(request).not.toHaveValue("");

  await expect(sampleButtons(page).first()).toBeVisible();

  await runButton(page).click();

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 60_000 });

  const validationStatus = await namedPanel(page, /validation status/i);
  await expect(validationStatus).toBeVisible();
  await expect(validationStatus).toContainText(/\b(success|valid|passed|ok)\b|no validation errors/i);

  const schema = await namedPanel(page, /schema/i);
  await expect(schema).toBeVisible();
  const schemaText = await waitForPanelBodyText(schema, /schema/i);
  expect(schemaText).toMatch(/schema|extraction|structured|record|object/i);
  await expect(schema).toContainText(/field|properties|type|required|string|array|number|boolean/i);

  const structuredResult = await namedPanel(page, /structured result|extracted fields/i);
  await expect(structuredResult).toBeVisible();
  await waitForPanelBodyText(structuredResult, /structured result|extracted fields/i);
  await expect(structuredResult).toContainText(/[A-Za-z0-9]/);

  const fieldTable = await namedPanel(page, /field table/i);
  await expect(fieldTable).toBeVisible();
  await assertPopulatedFieldTable(fieldTable);

  const rawJson = await namedPanel(page, /raw json/i);
  await expect(rawJson).toBeVisible();
  await waitForPanelBodyText(rawJson, /raw json/i);
  await expect(rawJson).toContainText(/[{}[\]"]/);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelBodyText(finalState, /final state/i);
  await expect(finalState).toContainText(/schema|structured|parsed|validation|result|fields/i);

  await populatedRawEvents(page);
});
