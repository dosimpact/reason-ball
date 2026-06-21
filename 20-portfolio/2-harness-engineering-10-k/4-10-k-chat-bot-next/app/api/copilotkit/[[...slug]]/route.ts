import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotHonoHandler } from "@copilotkit/runtime/v2/hono";
import { handle } from "hono/vercel";

function getInvestmentAssistantAgentUrl(request: Request) {
  const explicitUrl = process.env.COPILOTKIT_LANGGRAPH_HTTP_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const requestUrl = new URL(request.url);
  const port = requestUrl.port || process.env.PORT?.trim() || "3000";

  return `http://127.0.0.1:${port}/api/investment-assistant/langgraph-http`;
}

const runtime = new CopilotRuntime({
  agents: ({ request }) => ({
    "investment-assistant": new LangGraphHttpAgent({
      url: getInvestmentAssistantAgentUrl(request),
    }),
  }),
  a2ui: {},
});

const app = createCopilotHonoHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handle(app);
export const POST = handle(app);
