import { HttpAgent } from "@ag-ui/client";
import { CopilotRuntime, InMemoryAgentRunner, createCopilotEndpointSingleRoute } from "@copilotkit/runtime/v2";
import { A2UiDynamicCatalog as dynamicCatalog } from "@/shared/config";
import { A2UiFixedCatalog as fixedCatalog } from "@/shared/config";
import { A2UiSecCatalog as secCatalog } from "@/shared/config";

export function createDemoEndpoint(mode: "dynamic" | "fixed" | "sec") {
  const schema = { dynamic: dynamicCatalog, fixed: fixedCatalog, sec: secCatalog }[mode];
  const basePath = `/api/copilotkit/a2ui/${mode}`;
  const serviceUrl = process.env.A2UI_LANGGRAPH_URL ?? "http://127.0.0.1:8000";
  const runtime = new CopilotRuntime({
    agents: { [`a2ui-${mode}`]: new HttpAgent({ url: `${serviceUrl.replace(/\/$/, "")}/ag-ui/a2ui/${mode}` }) },
    runner: new InMemoryAgentRunner(),
    a2ui: {
      schema, injectA2UITool: false, defaultCatalogId: schema.catalogId,
      // Publish only the server-validated ToolMessage envelope. Nested model
      // tokens still stream over AG-UI, but cannot paint an unchecked surface.
      a2uiToolNames: [],
    },
  });
  const endpoint = createCopilotEndpointSingleRoute({ runtime, basePath });
  return (request: Request) => endpoint.fetch(request);
}
