import { Client } from "@langchain/langgraph-sdk";
import { expect, Locator, Page, test } from "@playwright/test";

test.setTimeout(150_000);
test.describe.configure({ mode: "serial" });

const API_URL = "http://localhost:2931";
const MEMORY_NAMESPACE_PREFIX = ["memories", "long-term-memory-ui"];

type CleanupTarget = {
  userId: string;
  memoryKey: string;
};

const cleanupTargets: CleanupTarget[] = [];

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

  await page.getByRole("button", { name: /16 Long-term Memory UI/i }).click();

  await expect(page.getByRole("heading", { name: /Long-term Memory UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    API_URL,
  );
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function userIdInput(page: Page) {
  return workspace(page)
    .getByRole("textbox", { name: /user id|user identifier|user/i })
    .or(workspace(page).getByPlaceholder(/user id|user identifier/i))
    .first();
}

function memoryKeyInput(page: Page) {
  return workspace(page)
    .getByRole("textbox", {
      name: /memory\s+(key|id)|key\s*\/\s*id|id\s*\/\s*key|memory identifier/i,
    })
    .or(workspace(page).getByPlaceholder(/memory\s+(key|id)|key\s*\/\s*id|id\s*\/\s*key/i))
    .first();
}

function memoryContentInput(page: Page) {
  return workspace(page)
    .locator("textarea")
    .or(
      workspace(page).getByRole("textbox", {
        name: /memory content|content|memory text|preference|note/i,
      }),
    )
    .first();
}

function memoryButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function createMemoryButton(page: Page) {
  return memoryButton(page, /create\s+memory|save\s+memory|add\s+memory/i);
}

function updateMemoryButton(page: Page) {
  return memoryButton(page, /update\s+memory|edit\s+memory/i);
}

function deleteMemoryButton(page: Page) {
  return memoryButton(page, /delete\s+memory|remove\s+memory/i);
}

function recallMemoriesButton(page: Page) {
  return memoryButton(page, /recall\s+memories|recall\s+memory|load\s+memories/i);
}

function recallInNewThreadButton(page: Page) {
  return memoryButton(page, /recall\s+in\s+new\s+thread|new\s+thread\s+recall|cross-thread/i);
}

function recallOtherUserButton(page: Page) {
  return memoryButton(page, /recall\s+other\s+user|other\s+user|different\s+user/i);
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

async function waitForPanelNotContaining(
  panel: Locator,
  title: RegExp,
  text: string,
  timeout = 45_000,
) {
  await expect
    .poll(async () => (await panelBodyText(panel, title)).includes(text), { timeout })
    .toBe(false);
}

async function fillMemoryEditor(page: Page, userId: string, key: string, content: string) {
  await userIdInput(page).fill(userId);
  await memoryKeyInput(page).fill(key);
  await memoryContentInput(page).fill(content);
}

async function assertInitialControls(page: Page) {
  const editor = await namedPanel(page, /memory editor/i);
  await expect(editor).toBeVisible();

  await expect(userIdInput(page)).toBeVisible();
  await expect(memoryKeyInput(page)).toBeVisible();
  await expect(memoryContentInput(page)).toBeVisible();

  await expect(createMemoryButton(page)).toBeVisible();
  await expect(updateMemoryButton(page)).toBeVisible();
  await expect(deleteMemoryButton(page)).toBeVisible();
  await expect(recallMemoriesButton(page)).toBeVisible();
  await expect(recallInNewThreadButton(page)).toBeVisible();
}

async function assertThreadAndDurablePanelsAreSeparate(page: Page, expectedContent: string) {
  const durableMemories = await namedPanel(page, /durable memories/i);
  const threadState = await namedPanel(page, /thread state/i);

  await expect(durableMemories).toBeVisible();
  await expect(threadState).toBeVisible();
  await expect(durableMemories).toContainText(expectedContent);

  const durableText = await panelBodyText(durableMemories, /durable memories/i);
  const threadText = await panelBodyText(threadState, /thread state/i);
  expect(threadText).toMatch(/thread|thread_notes|thread notes|local|primary|new thread|state/i);
  expect(threadText).not.toBe(durableText);
}

async function assertMemoryEvents(page: Page) {
  const panel = await namedPanel(page, /memory events/i);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/memory_operation|memory operation|create|recall|update|delete/i);
  await expect(panel).toContainText(/create|stored/i);
  await expect(panel).toContainText(/recall|loaded/i);
  await expect(panel).toContainText(/update|updated/i);
  await expect(panel).toContainText(/delete|deleted/i);
  return panel;
}

async function assertFinalPanels(page: Page) {
  const finalAnswer = await namedPanel(page, /final answer/i);
  await expect(finalAnswer).toBeVisible();
  await waitForPanelText(finalAnswer, /final answer/i, /durable|memory|loaded|thread|store/i, 30_000);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelText(finalState, /final state/i, /memories|memory_operations|memory operations/i);
  await expect(finalState).toContainText(/user_id|user id/i);
  await expect(finalState).toContainText(/namespace|long-term-memory-ui/i);
  await expect(finalState).toContainText(/thread_notes|thread notes/i);
  await expect(finalState).toContainText(/memory_events|memory events/i);
  await expect(finalState).toContainText(/memory_operations|memory operations/i);
}

async function assertRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(panel).toContainText(/updates?/i);
  await expect(panel).toContainText(/custom/i);
  await expect(panel).toContainText(/memory_operation|memory operation|create|recall|update|delete/i);
  await expect(panel).toContainText(/final|assistant_response|memories/i);
  return panel;
}

async function assertOptionalOtherUserIsolation(page: Page, testContent: string) {
  const otherUserButton = recallOtherUserButton(page);
  if ((await otherUserButton.count()) === 0) return;

  await otherUserButton.click();

  const proofPanel = await namedPanel(page, /cross-thread proof/i);
  await expect(proofPanel).toBeVisible();
  await waitForPanelText(
    proofPanel,
    /cross-thread proof/i,
    /other user|different user|isolated|no durable|0 durable|no memories|not found/i,
    60_000,
  );
  const isolationLine = proofPanel.locator(".isolation-line").first();
  if ((await isolationLine.count()) > 0) {
    await expect(isolationLine).toContainText(/0 durable memories|no durable|no memories/i);
    await expect(isolationLine).not.toContainText(testContent);
  }
}

test.afterEach(async () => {
  const targets = cleanupTargets.splice(0);
  if (targets.length === 0) return;

  const client = new Client({ apiUrl: API_URL });
  await Promise.all(
    targets.map(({ userId, memoryKey }) =>
      client.store
        .deleteItem([...MEMORY_NAMESPACE_PREFIX, userId], memoryKey)
        .catch(() => undefined),
    ),
  );
});

test("Long-term Memory UI persists user-scoped memory across threads and cleans it up", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialControls(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const userId = `e2e-memory-user-${uniqueId}`;
  const memoryKey = `e2e-memory-key-${uniqueId}`;
  const originalContent = `E2E durable preference ${uniqueId}: prefer concise memory summaries with teal status chips.`;
  const updatedContent = `E2E durable preference ${uniqueId}: prefer explicit cross-thread proof with green status chips.`;
  cleanupTargets.push({ userId, memoryKey });

  await fillMemoryEditor(page, userId, memoryKey, originalContent);
  await createMemoryButton(page).click();

  const durableMemories = await namedPanel(page, /durable memories/i);
  await expect(durableMemories).toBeVisible({ timeout: 45_000 });
  await waitForPanelText(durableMemories, /durable memories/i, originalContent, 60_000);
  await expect(durableMemories).toContainText(memoryKey);
  await expect(durableMemories).toContainText(userId);
  await assertThreadAndDurablePanelsAreSeparate(page, originalContent);

  await recallMemoriesButton(page).click();
  await waitForPanelText(durableMemories, /durable memories/i, originalContent, 60_000);

  await recallInNewThreadButton(page).click();

  const crossThreadProof = await namedPanel(page, /cross-thread proof/i);
  await expect(crossThreadProof).toBeVisible({ timeout: 45_000 });
  await waitForPanelText(crossThreadProof, /cross-thread proof/i, originalContent, 60_000);
  await expect(crossThreadProof).toContainText(userId);
  await expect(crossThreadProof).toContainText(/new thread|same user|cross-thread|durable|recalled/i);

  await assertOptionalOtherUserIsolation(page, originalContent);

  await fillMemoryEditor(page, userId, memoryKey, updatedContent);
  await updateMemoryButton(page).click();
  await waitForPanelText(durableMemories, /durable memories/i, updatedContent, 60_000);
  await expect(durableMemories).toContainText(memoryKey);
  await waitForPanelNotContaining(durableMemories, /durable memories/i, originalContent);

  await fillMemoryEditor(page, userId, memoryKey, updatedContent);
  await deleteMemoryButton(page).click();
  await waitForPanelNotContaining(durableMemories, /durable memories/i, updatedContent, 60_000);
  await expect(durableMemories).toContainText(
    /no durable|0 durable|0 memories|no memories|deleted|not found|empty/i,
  );

  await assertMemoryEvents(page);
  await assertFinalPanels(page);
  await assertRawEvents(page);
});
