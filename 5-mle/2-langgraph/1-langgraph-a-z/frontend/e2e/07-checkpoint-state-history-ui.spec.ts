import { expect, Locator, Page, test } from "@playwright/test";

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
  await page.getByRole("button", { name: /07 Checkpoint\s*\/\s*State History UI/i }).click();

  await expect(
    page.getByRole("heading", { name: /Checkpoint\s*\/\s*State History UI/i }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function promptInput(page: Page) {
  return page.getByRole("textbox", { name: /prompt|topic|input|request/i }).first();
}

function runButton(page: Page) {
  return page
    .getByRole("button", { name: /run checkpoint history/i })
    .or(page.getByRole("button", { name: /^run$/i }))
    .first();
}

function checkpointEntries(historyPanel: Locator) {
  return historyPanel.getByRole("button", { name: /checkpoint\s+\d+/i });
}

function extractThreadId(text: string) {
  const patterns = [
    /\bthread\s*id\s*[:#]?\s*([0-9a-f]{8}-[0-9a-f-]{13,}|[A-Za-z0-9][A-Za-z0-9_-]{7,})\b/i,
    /\bthread\s*[:#]\s*([0-9a-f]{8}-[0-9a-f-]{13,}|[A-Za-z0-9][A-Za-z0-9_-]{7,})\b/i,
    /"thread_id"\s*:\s*"([^"]+)"/i,
    /"threadId"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

function extractCheckpointId(text: string) {
  const patterns = [
    /\bcheckpoint\s*id\s*[:#]?\s*([A-Za-z0-9_.:-]{6,})\b/i,
    /\bcheckpoint\s*[:#]\s*([A-Za-z0-9_.:-]{6,})\b/i,
    /"checkpoint_id"\s*:\s*"([^"]+)"/i,
    /"checkpointId"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function visibleThreadId(page: Page) {
  await expect
    .poll(async () => extractThreadId(await page.locator("body").innerText()), { timeout: 10_000 })
    .not.toBe("");

  const threadId = extractThreadId(await page.locator("body").innerText());
  if (!threadId) throw new Error("Expected a visible thread id.");
  return threadId;
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(panel).toContainText(/checkpoint|thread|updates|values|run/i);
  return panel;
}

test("Checkpoint / State History UI shows checkpoint details and state diff", async ({ page }) => {
  await selectExample(page);

  const input = promptInput(page);
  await expect(input).toBeVisible();
  await expect(input).not.toHaveValue("");

  await runButton(page).click();

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 30_000 });
  const threadId = await visibleThreadId(page);
  await expect(page.locator("body")).toContainText(new RegExp(escapeRegExp(threadId)));

  const currentState = await namedPanel(page, /current state/i);
  await expect(currentState).toBeVisible();
  await expect(currentState).toContainText(/topic|prompt|state|messages|summary|steps/i);

  const historyPanel = await namedPanel(page, /checkpoint history/i);
  await expect(historyPanel).toBeVisible();

  const checkpoints = checkpointEntries(historyPanel);
  await expect.poll(async () => checkpoints.count(), { timeout: 10_000 }).toBeGreaterThan(1);
  await expect(checkpoints.first()).toBeVisible();

  const earlierCheckpoint = checkpoints.nth(1);
  await expect(earlierCheckpoint).toBeVisible();
  const earlierCheckpointText = normalizeText(await earlierCheckpoint.innerText());
  await earlierCheckpoint.click();

  const selectedCheckpoint = await namedPanel(page, /selected checkpoint/i);
  await expect(selectedCheckpoint).toBeVisible();
  await expect(selectedCheckpoint).not.toContainText(/no checkpoint selected/i);
  await expect(selectedCheckpoint).toContainText(/checkpoint|metadata|values|next|created/i);

  const checkpointId = extractCheckpointId(earlierCheckpointText);
  if (checkpointId) {
    await expect(selectedCheckpoint).toContainText(new RegExp(escapeRegExp(checkpointId)));
  }

  const stateDiff = await namedPanel(page, /state diff/i);
  await expect(stateDiff).toBeVisible();
  await expect(stateDiff).toContainText(/changed/i);
  await expect(stateDiff).toContainText(/current/i);
  await expect(stateDiff).toContainText(/selected/i);

  await populatedRawEvents(page);
});
