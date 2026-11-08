import { expect, Locator, Page, test } from "@playwright/test";

const replayTopicOverride = "Mars habitat disaster recovery with stricter budget constraints";
const replayInstructionOverride =
  "Replay from the selected checkpoint and emphasize what changed after the fork.";

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
  await page.getByRole("button", { name: /08 Time Travel\s*\/\s*Replay UI/i }).click();

  await expect(page.getByRole("heading", { name: /Time Travel\s*\/\s*Replay UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function originalTopicInput(page: Page) {
  return page
    .getByRole("textbox", { name: /original topic/i })
    .or(page.getByRole("textbox", { name: /topic|prompt|request/i }))
    .or(page.getByPlaceholder(/original topic|topic|prompt/i))
    .first();
}

function runOriginalButton(page: Page) {
  return page.getByRole("button", { name: /run original timeline/i }).first();
}

function replayButton(page: Page) {
  return page.getByRole("button", { name: /replay from selected checkpoint/i }).first();
}

function checkpointEntries(historyPanel: Locator) {
  return historyPanel.getByRole("button", {
    name: /checkpoint|step|source|state|timeline|node/i,
  });
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

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText((await panel.innerText()).replace(title, ""));
}

async function waitForPanelBodyText(panel: Locator, title: RegExp, timeout = 10_000) {
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).not.toBe("");
  return panelBodyText(panel, title);
}

async function fillReplayOverride(page: Page) {
  const replayTopic = page
    .getByRole("textbox", { name: /replay topic|fork topic|topic override/i })
    .or(page.getByPlaceholder(/replay topic|fork topic|topic override/i))
    .first();

  if ((await replayTopic.count()) > 0 && (await replayTopic.isVisible())) {
    await replayTopic.fill(replayTopicOverride);
    return replayTopicOverride;
  }

  const replayInstruction = page
    .getByRole("textbox", { name: /replay instruction|fork instruction|instruction override|instruction/i })
    .or(page.getByPlaceholder(/replay instruction|fork instruction|instruction override/i))
    .first();

  await expect(replayInstruction).toBeVisible();
  await replayInstruction.fill(replayInstructionOverride);
  return replayInstructionOverride;
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(panel).toContainText(/checkpoint|thread|updates|values|run|replay|fork/i);
  return panel;
}

test("Time Travel / Replay UI replays from a selected checkpoint", async ({ page }) => {
  await selectExample(page);

  const originalInput = originalTopicInput(page);
  await expect(originalInput).toBeVisible();
  await expect(originalInput).not.toHaveValue("");

  await runOriginalButton(page).click();

  await expect(
    page.getByText(/^Original complete$|^Original timeline complete$|^Run complete$/i).first(),
  ).toBeVisible({ timeout: 30_000 });

  const originalThreadId = await visibleThreadId(page);
  await expect(page.locator("body")).toContainText(new RegExp(escapeRegExp(originalThreadId)));

  const originalResult = await namedPanel(page, /original result/i);
  await expect(originalResult).toBeVisible();
  const originalResultText = await waitForPanelBodyText(originalResult, /original result/i);

  const historyPanel = await namedPanel(page, /checkpoint history/i);
  await expect(historyPanel).toBeVisible();

  const checkpoints = checkpointEntries(historyPanel);
  await expect.poll(async () => checkpoints.count(), { timeout: 10_000 }).toBeGreaterThan(1);

  const nonCurrentCheckpoints = checkpoints.filter({ hasNotText: /current|latest/i });
  const checkpointCount = await checkpoints.count();
  const nonCurrentCount = await nonCurrentCheckpoints.count();
  const selectedCheckpointEntry =
    nonCurrentCount > 0 && nonCurrentCount < checkpointCount
      ? nonCurrentCheckpoints.first()
      : checkpoints.nth(1);

  await expect(selectedCheckpointEntry).toBeVisible();
  const selectedCheckpointEntryText = normalizeText(await selectedCheckpointEntry.innerText());
  await selectedCheckpointEntry.click();

  const selectedCheckpoint = await namedPanel(page, /selected checkpoint/i);
  await expect(selectedCheckpoint).toBeVisible();
  await expect(selectedCheckpoint).not.toContainText(/no checkpoint selected/i);
  await expect(selectedCheckpoint).toContainText(/checkpoint/i);
  await expect(selectedCheckpoint).toContainText(/source/i);

  const selectedCheckpointId = extractCheckpointId(selectedCheckpointEntryText);
  if (selectedCheckpointId) {
    await expect(selectedCheckpoint).toContainText(new RegExp(escapeRegExp(selectedCheckpointId)));
  } else {
    await expect(selectedCheckpoint).toContainText(/checkpoint\s*id|checkpoint_id|checkpointId|id/i);
  }

  const replayResult = await namedPanel(page, /replay result/i);
  await expect(replayResult).toBeVisible();
  const replayResultBefore = await panelBodyText(replayResult, /replay result/i);

  await fillReplayOverride(page);

  const replay = replayButton(page);
  await expect(replay).toBeEnabled();
  await replay.click();

  await expect
    .poll(async () => panelBodyText(replayResult, /replay result/i), { timeout: 30_000 })
    .not.toBe(replayResultBefore);
  await expect(
    page.getByText(/^Replay complete$|^Replay run complete$|^Fork complete$|^Run complete$/i).first(),
  ).toBeVisible({ timeout: 30_000 });

  await expect(page.locator("body")).toContainText(new RegExp(escapeRegExp(originalThreadId)));

  const replayResultText = await waitForPanelBodyText(replayResult, /replay result/i, 30_000);
  expect(replayResultText).not.toBe(originalResultText);

  const comparison = await namedPanel(page, /replay comparison/i);
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText(/changed|different|diff|delta/i);
  await expect(comparison).toContainText(/fork|replay/i);

  await populatedRawEvents(page);
});
