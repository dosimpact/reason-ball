import { expect, Locator, Page, test } from "@playwright/test";

const calculatorPrompt = /calculator tool|multiply 12 by 7/i;

async function namedPanel(page: Page, name: RegExp) {
  const region = page.getByRole("region", { name }).first();
  if ((await region.count()) > 0) return region;

  const classPanel = page.locator("[class*='panel']").filter({ hasText: name }).first();
  if ((await classPanel.count()) > 0) return classPanel;

  return page
    .locator("section, article, aside")
    .filter({ hasText: name })
    .filter({ has: page.locator(".panel-title, h2, h3, summary") })
    .last();
}

function promptInput(page: Page) {
  return page
    .getByRole("textbox", { name: /prompt|message/i })
    .or(page.getByPlaceholder(calculatorPrompt))
    .first();
}

function assistantMessages(page: Page) {
  return page
    .locator(
      ".message-bubble.ai, .message-bubble.assistant, [data-role='assistant'], [data-message-role='assistant'], article",
    )
    .filter({ hasText: /assistant/i });
}

async function toolCard(page: Page): Promise<Locator> {
  const candidates = [
    page
      .getByRole("region", { name: /tool call|tool/i })
      .filter({ hasText: /calculator|calc|multiply/i })
      .first(),
    page
      .getByRole("article")
      .filter({ hasText: /calculator|calc|multiply/i })
      .filter({ hasText: /args|arguments|status|result|success|done|complete/i })
      .first(),
    page
      .locator("[data-testid*='tool' i], [class*='tool' i]")
      .filter({ hasText: /calculator|calc|multiply/i })
      .first(),
    page
      .locator("section, article, details")
      .filter({ hasText: /calculator|calc|multiply/i })
      .filter({ hasText: /args|arguments|status|result|success|done|complete/i })
      .first(),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count()) > 0) return candidate;
  }

  return candidates.at(-1)!;
}

test("Tool Calling / ReAct UI shows calculator tool execution and final answer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /05 Tool Calling\s*\/\s*ReAct UI/i }).click();

  await expect(page.getByRole("heading", { name: /Tool Calling\s*\/\s*ReAct UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );

  const input = promptInput(page);
  await expect(input).toHaveValue(calculatorPrompt);

  const sendButton = page
    .getByRole("button", { name: /^Send$/i })
    .or(page.getByRole("button", { name: /^Run tool call$/i }))
    .first();
  await sendButton.click();

  await expect(page.getByText(/Run complete$/i)).toBeVisible({ timeout: 30_000 });

  const card = await toolCard(page);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText(/calculator|calc|multiply/i);
  await expect(card).toContainText(/12/);
  await expect(card).toContainText(/7/);
  await expect(card).toContainText(/success|done|complete/i);
  await expect(card).toContainText(/84/);

  await expect(assistantMessages(page).last()).toContainText(/84/, { timeout: 10_000 });

  const rawEvents = await namedPanel(page, /raw stream events/i);
  await expect(rawEvents).toBeVisible();
  await expect(
    rawEvents.locator(".event-row, details, pre, code, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 10_000 });
});
