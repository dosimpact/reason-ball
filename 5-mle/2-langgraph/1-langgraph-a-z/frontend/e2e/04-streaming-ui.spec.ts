import { expect, Locator, Page, test } from "@playwright/test";

type StreamMode = "messages" | "updates" | "values" | "custom";

const modes: Array<{
  name: StreamMode;
  panelName: RegExp;
  contentHint: RegExp;
}> = [
  {
    name: "messages",
    panelName: /token|message output/i,
    contentHint: /stream|token|message|LangGraph/i,
  },
  {
    name: "updates",
    panelName: /state updates/i,
    contentHint: /agent|node|messages|update/i,
  },
  {
    name: "values",
    panelName: /values snapshots?/i,
    contentHint: /messages|prompt|answer|final/i,
  },
  {
    name: "custom",
    panelName: /custom progress events?/i,
    contentHint: /download|process|upload|progress|phase|chunk|done/i,
  },
];

const emptyPanelText =
  /No (message tokens|messages|state updates|values snapshots|custom progress events|events) yet|Waiting|Run the stream/gi;
const panelTitleText =
  /Token\s*\/?\s*Message Output|Message Output|State Updates|Values Snapshots?|Custom Progress Events?|Raw Stream Events/gi;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function streamPanel(page: Page, name: RegExp) {
  const region = page.getByRole("region", { name }).first();
  if ((await region.count()) > 0) return region;

  const classPanel = page.locator("[class*='panel']").filter({ hasText: name }).first();
  if ((await classPanel.count()) > 0) return classPanel;

  return page.locator("section, article").filter({ hasText: name }).last();
}

function modeControl(page: Page, mode: StreamMode) {
  const exactName = new RegExp(`^${mode}$`, "i");
  return page
    .getByRole("button", { name: exactName })
    .or(page.getByRole("radio", { name: exactName }))
    .or(page.getByLabel(exactName))
    .first();
}

async function panelText(panel: Locator) {
  return normalizeText(await panel.innerText().catch(() => ""));
}

async function expectPanelToReceiveContent(panel: Locator, beforeText: string, hint: RegExp) {
  await expect
    .poll(
      async () => {
        const text = await panelText(panel);
        const dynamicText = normalizeText(
          text.replace(panelTitleText, "").replace(emptyPanelText, ""),
        );
        return {
          changed: text !== beforeText,
          hasContent: dynamicText.length > 12,
          hasHint: hint.test(dynamicText),
        };
      },
      { timeout: 30_000 },
    )
    .toEqual({ changed: true, hasContent: true, hasHint: true });
}

async function runMode(page: Page, mode: (typeof modes)[number]) {
  const rawEvents = await streamPanel(page, /raw stream events/i);
  const modePanel = await streamPanel(page, mode.panelName);

  await expect(modeControl(page, mode.name)).toBeVisible();
  await expect(rawEvents).toBeVisible();
  await expect(modePanel).toBeVisible();

  const rawBefore = await panelText(rawEvents);
  const modePanelBefore = await panelText(modePanel);

  await modeControl(page, mode.name).click();
  await page.getByRole("button", { name: /run/i }).first().click();

  await expect
    .poll(async () => panelText(rawEvents), { timeout: 30_000 })
    .not.toBe(rawBefore);
  await expect(page.getByText("Run complete")).toBeVisible({ timeout: 30_000 });
  await expect(rawEvents).toContainText(new RegExp(mode.name, "i"), { timeout: 10_000 });
  await expectPanelToReceiveContent(modePanel, modePanelBefore, mode.contentHint);
}

test("Streaming UI exercises all SDK stream modes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /04 Streaming UI/i }).click();

  await expect(page.getByRole("heading", { name: "Streaming UI" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );

  const promptInput = page.getByRole("textbox", { name: /prompt|input|message/i }).first();
  await expect(promptInput).toHaveValue(/stream/i);
  await promptInput.fill(
    "Start with the words Streaming UI helps. Then give one short reason.",
  );

  for (const mode of modes) {
    await runMode(page, mode);
  }
});
