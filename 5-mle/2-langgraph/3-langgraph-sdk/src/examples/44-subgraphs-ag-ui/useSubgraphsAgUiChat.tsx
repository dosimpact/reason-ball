import { useAgentContext, useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { runSubgraphWorkersParameters } from "./model";
import { RunSubgraphWorkersRenderer } from "./ToolRenderers";

export function useSubgraphsAgUiChat() {
  useAgentContext({
    description: "Current AG-UI example",
    value: "Example 44: Subgraphs AG-UI",
  });

  useRenderTool({
    name: "run_subgraph_workers",
    parameters: runSubgraphWorkersParameters,
    render: (props) => <RunSubgraphWorkersRenderer {...props} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Coordinate workers",
        message:
          "Use the subgraph workers to prepare a release readiness brief with research, analysis, and writing outputs.",
      },
      {
        title: "Plan incident review",
        message: "Run subgraphs for an incident review: collect facts, rank risks, and draft the response.",
      },
    ],
    available: "always",
  });

  return {};
}
