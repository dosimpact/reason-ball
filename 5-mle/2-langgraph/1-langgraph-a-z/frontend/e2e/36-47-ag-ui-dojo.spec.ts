import { expect, type Page, test } from "@playwright/test";

test.setTimeout(90_000);

type ExampleCheck = {
  id: number;
  title: string;
  planPath: string;
  requiredText: Array<string | RegExp>;
  suggestions: string[];
};

const examples: ExampleCheck[] = [
  {
    id: 36,
    title: "Backend Tool Rendering AG-UI",
    planPath: "plan/36-backend-tool-rendering-ag-ui.md",
    requiredText: [/How can I help you today/i],
    suggestions: ["Search inventory", "Warehouse status"],
  },
  {
    id: 37,
    title: "Human in the Loop AG-UI",
    planPath: "plan/37-human-in-the-loop-ag-ui.md",
    requiredText: ["Approval Console", "No approval is pending"],
    suggestions: ["Approve a rollout", "Review a publish plan"],
  },
  {
    id: 38,
    title: "Agentic Generative UI AG-UI",
    planPath: "plan/38-agentic-generative-ui-ag-ui.md",
    requiredText: ["Generated Workspace", "latest backend workspace payload"],
    suggestions: ["Generate workspace", "Create launch plan"],
  },
  {
    id: 39,
    title: "Tool Based Generative UI AG-UI",
    planPath: "plan/39-tool-based-generative-ui-ag-ui.md",
    requiredText: [/How can I help you today/i],
    suggestions: ["Haiku card", "Bright poem card"],
  },
  {
    id: 40,
    title: "Shared State Between Agent and UI AG-UI",
    planPath: "plan/40-shared-state-agent-ui-ag-ui.md",
    requiredText: ["Shared Recipe State", "Agent Collaboration", "Loaded starter recipe state"],
    suggestions: ["Read recipe", "Make it spicy"],
  },
  {
    id: 41,
    title: "Predictive State Updates AG-UI",
    planPath: "plan/41-predictive-state-updates-ag-ui.md",
    requiredText: ["Predictive Document", "Revision 1", "Prediction: none"],
    suggestions: ["Shorten document", "Explain revision"],
  },
  {
    id: 42,
    title: "Agentic Chat Reasoning AG-UI",
    planPath: "plan/42-agentic-chat-reasoning-ag-ui.md",
    requiredText: ["Reasoning Status", "Hidden chain-of-thought is not requested"],
    suggestions: ["Show reasoning summary", "Policy fact"],
  },
  {
    id: 43,
    title: "Agentic Chat Multimodal AG-UI",
    planPath: "plan/43-agentic-chat-multimodal-ag-ui.md",
    requiredText: ["Image Preview", "No preview selected", "Selected metadata"],
    suggestions: ["Analyze attached image", "Text-only fallback"],
  },
  {
    id: 44,
    title: "Subgraphs AG-UI",
    planPath: "plan/44-subgraphs-ag-ui.md",
    requiredText: ["Subgraph State", "Parent route and aggregation status", "Named worker subgraph results"],
    suggestions: ["Coordinate workers", "Plan incident review"],
  },
  {
    id: 45,
    title: "A2UI Fixed Schema AG-UI",
    planPath: "plan/45-a2ui-fixed-schema-ag-ui.md",
    requiredText: ["Fixed Schema", "Flight cards render only"],
    suggestions: ["Search flights", "Try another route"],
  },
  {
    id: 46,
    title: "A2UI Dynamic Schema AG-UI",
    planPath: "plan/46-a2ui-dynamic-schema-ag-ui.md",
    requiredText: ["Dynamic Schema", "Only form, list, comparison, and summary nodes render directly"],
    suggestions: ["Comparison UI", "Intake form", "Checklist"],
  },
  {
    id: 47,
    title: "A2UI Advanced AG-UI",
    planPath: "plan/47-a2ui-advanced-ag-ui.md",
    requiredText: ["Advanced A2UI", "No frontend action confirmed yet"],
    suggestions: ["Build decision UI", "Incident review"],
  },
];

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

async function selectExample(page: Page, example: ExampleCheck) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: new RegExp(`${example.id}\\s+${example.title}`, "i") }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`^(?:${example.id}\\s+)?${example.title}$`, "i") })).toBeVisible();
}

async function assertCopilotSurface(page: Page) {
  const main = workspace(page);
  await expect(main.locator('[data-testid="copilot-chat"]').first()).toBeVisible();
  await expect(main.locator('[data-testid="copilot-chat-textarea"]').first()).toBeVisible();
  await expect(main.locator('[data-testid="copilot-send-button"]').first()).toBeVisible();
}

for (const example of examples) {
  test(`AG-UI Dojo example ${example.id} renders ${example.title}`, async ({ page }) => {
    // plan scenario: e2e-plan/{slug}.md surface checks
    await selectExample(page, example);

    const main = workspace(page);
    await expect(main).toContainText(example.planPath);
    for (const text of example.requiredText) {
      await expect(main).toContainText(text);
    }
    for (const suggestion of example.suggestions) {
      await expect(main.locator('[data-testid="copilot-suggestion"]', { hasText: suggestion })).toBeVisible();
    }
    await assertCopilotSurface(page);
  });
}

test("AG-UI Dojo examples expose local non-runtime interactions", async ({ page }) => {
  await selectExample(page, examples[4]);
  await page.getByRole("button", { name: /^Add protein$/i }).click();
  await expect(page.locator('[data-testid="shared-recipe-panel"]')).toContainText("roasted tofu");
  await page.getByRole("button", { name: /^Reset$/i }).click();
  await expect(page.locator('[data-testid="shared-recipe-panel"]')).toContainText("UI reset the shared recipe");

  await selectExample(page, examples[5]);
  await page.getByRole("button", { name: /^Predict shorten$/i }).click();
  await expect(page.locator('[data-testid="predictive-document-panel"]')).toContainText(/shorten:pending|Prediction: shorten/i);
  await page.getByRole("button", { name: /^Confirm$/i }).click();
  await expect(page.locator('[data-testid="predictive-document-panel"]')).toContainText(/shorten:confirmed|confirmed/i);

  await selectExample(page, examples[7]);
  await page.getByRole("button", { name: /^Sample$/i }).click();
  await expect(page.locator('[data-testid="multimodal-preview-panel"]')).toContainText("ag-ui-multimodal-sample.png");
  await page.getByRole("button", { name: /^Reset$/i }).click();
  await expect(page.locator('[data-testid="multimodal-preview-panel"]')).toContainText("Name: none");
});

test("Example navigation groups collapse and expand by category", async ({ page }) => {
  await page.goto("/");

  const coreToggle = page.getByRole("button", { name: /Core\s+13/i });
  await expect(coreToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /08\s+Time Travel/i })).toBeVisible();

  await coreToggle.click();
  await expect(coreToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: /08\s+Time Travel/i })).toHaveCount(0);

  await coreToggle.click();
  await expect(coreToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /08\s+Time Travel/i })).toBeVisible();
});
