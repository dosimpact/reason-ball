import { useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { buildTaskWorkspaceParameters } from "./model";
import { BuildTaskWorkspaceRenderer } from "./ToolRenderers";

export function useAgenticGenerativeUiAgUiChat() {
  useRenderTool({
    name: "build_task_workspace",
    parameters: buildTaskWorkspaceParameters,
    render: (props) => <BuildTaskWorkspaceRenderer {...props} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Generate workspace",
        message: "Build a generated workspace for validating AG-UI progress states.",
      },
      {
        title: "Create launch plan",
        message: "Create a task workspace for shipping backend tool rendering examples.",
      },
    ],
    available: "always",
  });

  return {};
}
