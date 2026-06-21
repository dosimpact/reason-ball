import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.setTimeout(150_000);
test.describe.configure({ mode: "serial" });

type LiveCopilotExample = {
  id: number;
  title: string;
  agentId: string;
  prompt: string;
};

const liveExamples: LiveCopilotExample[] = [
  {
    id: 35,
    title: "Agentic Chat AG-UI",
    agentId: "agentic_chat",
    prompt: "Reply with a short AG-UI live smoke test acknowledgement.",
  },
  {
    id: 36,
    title: "Backend Tool Rendering AG-UI",
    agentId: "backend_tool_rendering",
    prompt: "Search inventory for demo items.",
  },
  {
    id: 37,
    title: "Human in the Loop AG-UI",
    agentId: "human_in_the_loop_ag_ui",
    prompt: "Draft an approval plan for a staged release.",
  },
  {
    id: 38,
    title: "Agentic Generative UI AG-UI",
    agentId: "agentic_generative_ui",
    prompt: "Generate a workspace for LangGraph SDK onboarding.",
  },
  {
    id: 39,
    title: "Tool Based Generative UI AG-UI",
    agentId: "tool_based_generative_ui",
    prompt: "Create a bright haiku card for a live CopilotKit check.",
  },
  {
    id: 40,
    title: "Shared State Between Agent and UI AG-UI",
    agentId: "shared_state_agent_ui",
    prompt: "Read the current recipe state and suggest one small change.",
  },
  {
    id: 41,
    title: "Predictive State Updates AG-UI",
    agentId: "predictive_state_updates",
    prompt: "Shorten the predictive document and explain the revision.",
  },
  {
    id: 42,
    title: "Agentic Chat Reasoning AG-UI",
    agentId: "agentic_chat_reasoning",
    prompt: "Show a concise reasoning summary for a policy fact check.",
  },
  {
    id: 43,
    title: "Agentic Chat Multimodal AG-UI",
    agentId: "agentic_chat_multimodal",
    prompt: "Handle this as a text-only multimodal fallback check.",
  },
  {
    id: 44,
    title: "Subgraphs AG-UI",
    agentId: "subgraphs_ag_ui",
    prompt: "Coordinate workers for an incident review.",
  },
  {
    id: 45,
    title: "A2UI Fixed Schema AG-UI",
    agentId: "a2ui_fixed_schema",
    prompt: "Search flights for SFO to JFK tomorrow.",
  },
  {
    id: 46,
    title: "A2UI Dynamic Schema AG-UI",
    agentId: "a2ui_dynamic_schema",
    prompt: "Create a comparison UI for three rollout options.",
  },
  {
    id: 47,
    title: "A2UI Advanced AG-UI",
    agentId: "a2ui_advanced",
    prompt: "Build an advanced decision UI for an incident review.",
  },
];

const screenshotDir = "test-results/ag-ui-live-screenshots";

function agentRunFor(agentId: string) {
  return (response: { url: () => string; request: () => { method: () => string; postData: () => string | null } }) => {
    if (!response.url().includes("/api/copilotkit")) {
      return false;
    }

    const request = response.request();
    if (request.method() !== "POST") {
      return false;
    }

    const postData = request.postData() ?? "";
    return postData.includes('"method":"agent/run"') && postData.includes(`"agentId":"${agentId}"`);
  };
}

test("live CopilotKit runtime exposes all AG-UI agents", async ({ request }) => {
  // plan scenario: live runtime contract for 35-47 AG-UI Dojo examples.
  const response = await request.post("/api/copilotkit", {
    data: { method: "info" },
  });
  expect(response.status()).toBe(200);

  const info = await response.json();
  for (const example of liveExamples) {
    expect(info.agents, `agent ${example.agentId}`).toHaveProperty(example.agentId);
  }
});

for (const example of liveExamples) {
  test(`live CopilotKit run succeeds for ${example.id} ${example.title}`, async ({ page }) => {
    // plan scenario: live user chat -> CopilotKit runtime -> LangGraph graph.
    mkdirSync(screenshotDir, { recursive: true });

    const apiResponses: Array<{ method: string; status: number; url: string; postData: string }> = [];
    page.on("response", (response) => {
      if (!response.url().includes("/api/copilotkit")) {
        return;
      }

      apiResponses.push({
        method: response.request().method(),
        status: response.status(),
        url: response.url(),
        postData: response.request().postData() ?? "",
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: new RegExp(`${example.id}\\s+${example.title}`, "i") }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`^(?:${example.id}\\s+)?${example.title}$`, "i") })).toBeVisible();
    await expect(page.locator('[data-testid="copilot-chat-textarea"]').first()).toBeVisible();

    const runResponsePromise = page.waitForResponse(agentRunFor(example.agentId), { timeout: 120_000 });
    await page.locator('[data-testid="copilot-chat-textarea"]').first().fill(example.prompt);
    await page.locator('[data-testid="copilot-send-button"]').first().click();

    const runResponse = await runResponsePromise;
    expect(runResponse.status()).toBe(200);

    await page.waitForTimeout(5_000);
    await page.screenshot({
      path: `${screenshotDir}/${String(example.id).padStart(2, "0")}-${example.agentId}.png`,
      fullPage: true,
    });

    const failedCopilotResponses = apiResponses.filter((response) => response.status >= 400);
    expect(failedCopilotResponses).toEqual([]);
  });
}
