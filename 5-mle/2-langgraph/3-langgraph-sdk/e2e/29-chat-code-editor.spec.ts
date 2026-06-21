import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "chat_code_editor";

type StreamRequestRecord = {
  body: string;
  url: string;
};

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

async function isVisible(locator: Locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
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

function changeRequestInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /change request|request|prompt/i })
    .or(root.locator("textarea"))
    .first();
}

function fileSelect(page: Page) {
  return workspace(page).getByRole("combobox", { name: /^File$/i }).first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runButton(page: Page) {
  return actionButton(page, /^Run code agent$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

function approveButton(page: Page) {
  return actionButton(page, /^Approve change$/i);
}

function rejectButton(page: Page) {
  return actionButton(page, /^Reject change$/i);
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: /29\s+Chat \+ Code Editor/i }).click();
  await expect(page.getByRole("heading", { name: /^(?:29\s+)?Chat \+ Code Editor$/i })).toBeVisible();
  await expect(langGraphApiInput(page)).toHaveValue(API_URL);
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

function assertStreamRequests(records: StreamRequestRecord[], marker: string) {
  expect(records.length).toBeGreaterThanOrEqual(2);
  const serialized = records
    .map((record) => `${record.url}\n${JSON.stringify(parseJson(record.body) ?? record.body)}`)
    .join("\n");
  const strings = records.flatMap((record) => collectStrings(parseJson(record.body))).join(" ");

  expect(serialized).toContain(GRAPH_ID);
  expect(strings || serialized).toMatch(/\bupdates?\b/i);
  expect(strings || serialized).toMatch(/\bcustom\b/i);
  expect(serialized).toContain(marker);
  expect(serialized).toContain("app.py");
  expect(serialized).toContain("approve");
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(changeRequestInput(page)).toBeVisible();
  await expect(fileSelect(page)).toBeVisible();
  await expect(runButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();
  await expect(approveButton(page)).toBeVisible();
  await expect(rejectButton(page)).toBeVisible();

  for (const name of [
    /code editor status/i,
    /chat transcript/i,
    /code artifact/i,
    /diff proposal/i,
    /test log/i,
    /approval controls/i,
    /version history/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, name)).toBeVisible();
  }
}

test("Chat + Code Editor exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Chat + Code Editor proposes a diff and applies it after approval", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const marker = `E2E code editor marker ${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  await fileSelect(page).selectOption("app.py");
  await changeRequestInput(page).fill(
    `${marker}: add a safe test scaffold marker, show diff proposal, run dry-run tests, then wait for approval.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runButton(page).click();

  const statusPanel = await namedPanel(page, /code editor status/i);
  const chatPanel = await namedPanel(page, /chat transcript/i);
  const artifactPanel = await namedPanel(page, /code artifact/i);
  const diffPanel = await namedPanel(page, /diff proposal/i);
  const testPanel = await namedPanel(page, /test log/i);
  const approvalPanel = await namedPanel(page, /approval controls/i);
  const historyPanel = await namedPanel(page, /version history/i);
  const finalStatePanel = await namedPanel(page, /final state/i);
  const rawEventsPanel = await namedPanel(page, /raw stream events/i);

  await waitForPanelText(statusPanel, /code editor status/i, /awaiting_approval|a_approval|Proposal\s+ready/i, 120_000);
  await waitForPanelText(chatPanel, /chat transcript/i, /Assistant|proposal|minimal|safe|patch/i, 120_000);
  await waitForPanelText(artifactPanel, /code artifact/i, /app\.py|Code Editor|test scaffold|FastAPI/i);
  await waitForPanelText(diffPanel, /diff proposal/i, /--- a\/app\.py|@@|\+/);
  await waitForPanelText(testPanel, /test log/i, /passed|Dry-run|sandbox-policy|artifact-validator/i);
  await waitForPanelText(finalStatePanel, /final state/i, marker);
  await expect(approveButton(page)).toBeEnabled({ timeout: 90_000 });

  await approveButton(page).click();
  await waitForPanelText(statusPanel, /code editor status/i, /applied|approved|v1/i, 120_000);
  await waitForPanelText(approvalPanel, /approval controls/i, /Applied proposal|approved|v1/i);
  await waitForPanelText(historyPanel, /version history/i, /v1|app\.py/i);
  await waitForPanelText(finalStatePanel, /final state/i, /artifact_version|applied|approval_log/i);

  await expect(eventCards(rawEventsPanel).first()).toBeVisible({ timeout: 60_000 });
  await expect(rawEventsPanel).toContainText(/\bupdates?\b/i);
  await expect(rawEventsPanel).toContainText(/\bcustom\b/i);
  await expect(rawEventsPanel).toContainText(/chat_code_editor|propose|test|apply|final/i);

  streamRequests.stop();
  assertStreamRequests(streamRequests.records, marker);
});
