import { expect, Locator, Page, test } from "@playwright/test";

const defaultAction = /delete production database backup after summarizing risk/i;
const editedAction = "archive production database backup after summarizing risk and notify security";

async function namedPanel(page: Page, name: RegExp) {
  const region = page.getByRole("region", { name }).first();
  if ((await region.count()) > 0) return region;

  const classPanel = page.locator("[class*='panel']").filter({ hasText: name }).first();
  if ((await classPanel.count()) > 0) return classPanel;

  return page.locator("section, article, aside, details").filter({ hasText: name }).last();
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /06 Human-in-the-loop\s*\/\s*Interrupt UI/i }).click();

  await expect(
    page.getByRole("heading", { name: /Human-in-the-loop\s*\/\s*Interrupt UI/i }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function actionInput(page: Page) {
  return page
    .getByRole("textbox", { name: /action|prompt|request|instruction/i })
    .or(page.getByPlaceholder(defaultAction))
    .first();
}

function runButton(page: Page) {
  return page
    .getByRole("button", {
      name: /start approval run|start high-risk action|start action|run interrupt|run action|submit/i,
    })
    .or(page.getByRole("button", { name: /^run$/i }))
    .first();
}

function interruptActionButton(page: Page, interruptPanel: Locator, name: RegExp) {
  return interruptPanel.getByRole("button", { name }).or(page.getByRole("button", { name })).first();
}

async function startDefaultAction(page: Page) {
  const input = actionInput(page);
  await expect(input).toHaveValue(defaultAction);
  await runButton(page).click();
}

async function waitForInterrupt(page: Page) {
  const interruptPanel = await namedPanel(page, /interrupt|approval|human review|pending/i);

  await expect(interruptPanel).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^Interrupted$/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(interruptPanel).toContainText(/approval|interrupt|human/i);
  await expect(interruptPanel).toContainText(defaultAction);
  await expect(page.getByText(/^Run complete$/i)).toBeHidden();

  return interruptPanel;
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

async function visibleThreadId(page: Page) {
  await expect
    .poll(async () => extractThreadId(await page.locator("body").innerText()), { timeout: 10_000 })
    .not.toBe("");

  const threadId = extractThreadId(await page.locator("body").innerText());
  if (!threadId) throw new Error("Expected a visible thread id.");
  return threadId;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function rawEventsPanel(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 10_000 });
  return panel;
}

async function finalStatePanel(page: Page) {
  const panel = await namedPanel(page, /final state|final result|result|decision/i);
  await expect(panel).toBeVisible({ timeout: 10_000 });
  return panel;
}

test("Human-in-the-loop Interrupt UI resumes an edited approval in the same thread", async ({
  page,
}) => {
  await selectExample(page);
  await startDefaultAction(page);

  const interruptPanel = await waitForInterrupt(page);
  const threadId = await visibleThreadId(page);

  const editInput = interruptPanel
    .getByRole("textbox", { name: /edit|edited action|action/i })
    .or(page.getByRole("textbox", { name: /edit|edited action/i }))
    .first();
  await expect(editInput).toBeVisible();
  await editInput.fill(editedAction);

  await interruptActionButton(page, interruptPanel, /approve edited action|approve edited|approve with edit/i).click();

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("body")).toContainText(new RegExp(escapeRegExp(threadId)));

  const finalState = await finalStatePanel(page);
  await expect(finalState).toContainText(/EXECUTED/i);
  await expect(finalState).toContainText(editedAction);

  const rawEvents = await rawEventsPanel(page);
  await expect(rawEvents).toContainText(/interrupt|resume|updates|values|custom/i);
});

test("Human-in-the-loop Interrupt UI can reject a pending action", async ({ page }) => {
  await selectExample(page);
  await startDefaultAction(page);

  const interruptPanel = await waitForInterrupt(page);
  const threadId = await visibleThreadId(page);

  await interruptActionButton(page, interruptPanel, /^reject$|reject action|block/i).click();

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("body")).toContainText(new RegExp(escapeRegExp(threadId)));

  const finalState = await finalStatePanel(page);
  await expect(finalState).toContainText(/BLOCKED/i);

  await rawEventsPanel(page);
});
