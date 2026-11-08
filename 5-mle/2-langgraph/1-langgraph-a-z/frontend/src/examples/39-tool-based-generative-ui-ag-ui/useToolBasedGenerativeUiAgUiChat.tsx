import { useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { generateHaikuCardParameters } from "./model";
import { GenerateHaikuCardRenderer } from "./ToolRenderers";

export function useToolBasedGenerativeUiAgUiChat() {
  useRenderTool({
    name: "generate_haiku_card",
    parameters: generateHaikuCardParameters,
    render: (props) => <GenerateHaikuCardRenderer {...props} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Haiku card",
        message: "Generate a calm haiku card about LangGraph SDK examples.",
      },
      {
        title: "Bright poem card",
        message: "Generate a bright visual haiku card about backend tools rendering UI.",
      },
    ],
    available: "always",
  });

  return {};
}
