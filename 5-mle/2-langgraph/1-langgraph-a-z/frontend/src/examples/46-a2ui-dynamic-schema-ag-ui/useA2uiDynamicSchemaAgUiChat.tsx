import { useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { generateDynamicSchemaParameters } from "./model";
import { GenerateDynamicSchemaRenderer } from "./ToolRenderers";

export function useA2uiDynamicSchemaAgUiChat() {
  useRenderTool({
    name: "generate_dynamic_schema",
    parameters: generateDynamicSchemaParameters,
    render: (props) => <GenerateDynamicSchemaRenderer {...props} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Comparison UI",
        message: "Compare three deployment options for a LangGraph SDK demo.",
      },
      {
        title: "Intake form",
        message: "Create an intake form for collecting launch owner, deadline, and risk.",
      },
      {
        title: "Checklist",
        message: "Generate a checklist of implementation tasks for a dynamic A2UI renderer.",
      },
    ],
    available: "always",
  });

  return {};
}
