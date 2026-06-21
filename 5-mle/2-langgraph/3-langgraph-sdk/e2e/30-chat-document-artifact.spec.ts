import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const GRAPH_ID = "chat_document_artifact";

type StreamRequestRecord = {
  body: string;
  url: string;
};

function expectedApiUrl(page: Page) {
  const url = new URL(page.url());
  return `${url.protocol}//${url.hostname}:2931`;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function collectStrings(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return [value];
  if (typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
}

async function namedPanel(page: Page, name: RegExp) {
  const region = page.getByRole("region", { name }).first();
  if ((await region.count()) > 0) return region;
  return page.locator("[class*='panel']").filter({ hasText: name }).first();
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function langGraphApiInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /api url|langgraph api url/i }).first();
}

function documentRequestInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /document request|request|prompt/i })
    .or(root.locator("textarea"))
    .first();
}

function toneSelect(page: Page) {
  return workspace(page).getByRole("combobox", { name: /^Tone$/i }).first();
}

function lengthSelect(page: Page) {
  return workspace(page).getByRole("combobox", { name: /^Length$/i }).first();
}

function focusSectionSelect(page: Page) {
  return workspace(page).getByRole("combobox", { name: /^Focus section$/i }).first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runButton(page: Page) {
  return actionButton(page, /^Run document agent$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

function approveButton(page: Page) {
  return actionButton(page, /^Approve document$/i);
}

function rejectButton(page: Page) {
  return actionButton(page, /^Reject document$/i);
}

function saveUserEditsButton(page: Page) {
  return actionButton(page, /^Save user edits$/i);
}

function aiReviseCanvasButton(page: Page) {
  return actionButton(page, /^Ask AI to revise canvas$/i);
}

function documentTitleInput(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^Document title$/i }).first();
}

function overviewSectionEditor(page: Page) {
  return workspace(page).getByRole("textbox", { name: /^Edit Overview section$/i }).first();
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: /30\s+Chat \+ Document Artifact/i }).click();
  await expect(page.getByRole("heading", { name: /^(?:30\s+)?Chat \+ Document Artifact$/i })).toBeVisible();
  await expect(langGraphApiInput(page)).toHaveValue(expectedApiUrl(page));
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(/waiting|no .* yet|run .* to .*|empty|not available|pending/gi, ""),
  );
}

async function waitForPanelText(
  panel: Locator,
  title: RegExp,
  textOrPattern: string | RegExp,
  timeout = 60_000,
) {
  const pattern =
    typeof textOrPattern === "string" ? new RegExp(textOrPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : textOrPattern;
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).toMatch(pattern);
}

async function waitForInputValue(input: Locator, textOrPattern: string | RegExp, timeout = 60_000) {
  const pattern =
    typeof textOrPattern === "string" ? new RegExp(textOrPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : textOrPattern;
  await expect.poll(async () => input.inputValue(), { timeout }).toMatch(pattern);
}

function eventCards(panel: Locator) {
  return panel.locator(".event-row, [class*='event' i], details, pre, code, article, li");
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

function assertStreamRequests(records: StreamRequestRecord[], marker: string, manualEdit: string) {
  expect(records.length).toBeGreaterThanOrEqual(4);
  const serialized = records
    .map((record) => `${record.url}\n${JSON.stringify(parseJson(record.body) ?? record.body)}`)
    .join("\n");
  const strings = records.flatMap((record) => collectStrings(parseJson(record.body))).join(" ");

  expect(serialized).toContain(GRAPH_ID);
  expect(strings || serialized).toMatch(/\bupdates?\b/i);
  expect(strings || serialized).toMatch(/\bcustom\b/i);
  expect(serialized).toContain(marker);
  expect(serialized).toContain(manualEdit);
  expect(serialized).toContain("executive");
  expect(serialized).toContain("concise");
  expect(serialized).toContain("overview");
  expect(serialized).toContain("save_user_edit");
  expect(serialized).toContain("ai_revise");
  expect(serialized).toContain("approve");
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(documentRequestInput(page)).toBeVisible();
  await expect(toneSelect(page)).toBeVisible();
  await expect(lengthSelect(page)).toBeVisible();
  await expect(focusSectionSelect(page)).toBeVisible();
  await expect(runButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
  await expect(saveUserEditsButton(page)).toBeVisible();
  await expect(aiReviseCanvasButton(page)).toBeVisible();
  await expect(approveButton(page)).toBeVisible();
  await expect(rejectButton(page)).toBeVisible();

  for (const name of [
    /document artifact status/i,
    /chat transcript/i,
    /document canvas/i,
    /section changes/i,
    /ai comments/i,
    /quality review/i,
    /approval controls/i,
    /version history/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, name)).toBeVisible();
  }
}

test("Chat + Document Artifact exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Chat + Document Artifact proposes document edits and versions after approval", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const marker = `E2E document artifact marker ${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const manualEdit = `User canvas edit marker ${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  await toneSelect(page).selectOption("executive");
  await lengthSelect(page).selectOption("concise");
  await focusSectionSelect(page).selectOption("overview");
  await documentRequestInput(page).fill(
    `${marker}: rewrite the launch brief overview with clearer executive tone, section comments, quality review, and approval before versioning.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runButton(page).click();

  const statusPanel = await namedPanel(page, /document artifact status/i);
  const canvasPanel = await namedPanel(page, /document canvas/i);
  const changesPanel = await namedPanel(page, /section changes/i);
  const commentsPanel = await namedPanel(page, /ai comments/i);
  const qualityPanel = await namedPanel(page, /quality review/i);
  const approvalPanel = await namedPanel(page, /approval controls/i);
  const historyPanel = await namedPanel(page, /version history/i);
  const finalStatePanel = await namedPanel(page, /final state/i);
  const rawEventsPanel = await namedPanel(page, /raw stream events/i);

  await waitForPanelText(statusPanel, /document artifact status/i, /awaiting_approval|a_approval|Quality\s+92%|Sections\s+3/i, 120_000);
  await expect(documentTitleInput(page)).toHaveValue("Launch Readiness Brief");
  await waitForInputValue(overviewSectionEditor(page), /executive concise revision/i);
  await waitForPanelText(changesPanel, /section changes/i, /Overview|Rewritten|overview/i);
  await waitForPanelText(commentsPanel, /ai comments/i, /overview|suggestion|required/i);
  await waitForPanelText(qualityPanel, /quality review/i, /Tone|Structure|Actionability|passed/i);
  await waitForPanelText(finalStatePanel, /final state/i, marker);

  await overviewSectionEditor(page).fill(
    `${manualEdit}: User-authored overview text that must be saved before approval and available to AI revision.`,
  );
  await expect(saveUserEditsButton(page)).toBeEnabled();
  await saveUserEditsButton(page).click();
  await waitForInputValue(overviewSectionEditor(page), manualEdit, 120_000);
  await waitForPanelText(statusPanel, /document artifact status/i, /Last Editor\s+user|user/i, 120_000);
  await waitForPanelText(changesPanel, /section changes/i, /User edited this section directly/i);
  await waitForPanelText(finalStatePanel, /final state/i, manualEdit);

  await expect(aiReviseCanvasButton(page)).toBeEnabled({ timeout: 90_000 });
  await aiReviseCanvasButton(page).click();
  await waitForInputValue(overviewSectionEditor(page), /AI revised the current canvas|User canvas edit marker/i, 120_000);
  await waitForPanelText(statusPanel, /document artifact status/i, /Last Editor\s+ai|ai/i, 120_000);
  await waitForPanelText(changesPanel, /section changes/i, /AI revised the current editable canvas draft/i);
  await waitForPanelText(finalStatePanel, /final state/i, /ai_revised|last_editor/i);

  await expect(approveButton(page)).toBeEnabled({ timeout: 90_000 });

  await approveButton(page).click();
  await waitForPanelText(statusPanel, /document artifact status/i, /applied|approved|v1/i, 120_000);
  await waitForPanelText(approvalPanel, /approval controls/i, /Applied document version v1|approved/i);
  await waitForPanelText(historyPanel, /version history/i, /v1|Launch Readiness Brief/i);
  await waitForPanelText(finalStatePanel, /final state/i, /artifact_version|approval_log|applied/i);

  await expect(eventCards(rawEventsPanel).first()).toBeVisible({ timeout: 60_000 });
  await expect(rawEventsPanel).toContainText(/\bupdates?\b/i);
  await expect(rawEventsPanel).toContainText(/\bcustom\b/i);
  await expect(rawEventsPanel).toContainText(/chat_document_artifact|draft|evaluate|apply|final/i);

  streamRequests.stop();
  assertStreamRequests(streamRequests.records, marker, manualEdit);
});
