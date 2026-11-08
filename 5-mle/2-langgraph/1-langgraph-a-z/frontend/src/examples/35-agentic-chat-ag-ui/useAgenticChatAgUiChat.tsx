import { useState } from "react";
import { useAgentContext, useConfigureSuggestions, useFrontendTool, useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { getWeatherParameters } from "./model";
import { GetWeatherRenderer } from "./ToolRenderers";

export function useAgenticChatAgUiChat() {
  const [background, setBackground] = useState("--copilot-kit-background-color");

  useAgentContext({
    description: "Name of the user",
    value: "Bob",
  });

  useFrontendTool({
    name: "change_background",
    description:
      "Change the background color of the chat. Can be anything that the CSS background attribute accepts. Regular colors, linear or radial gradients etc.",
    parameters: z.object({
      background: z.string().describe("The background. Prefer gradients. Only use when asked."),
    }),
    handler: async ({ background: nextBackground }: { background: string }) => {
      setBackground(nextBackground);
      return {
        status: "success",
        message: `Background changed to ${nextBackground}`,
      };
    },
  });

  useRenderTool({
    name: "get_weather",
    parameters: getWeatherParameters,
    render: (props) => <GetWeatherRenderer {...props} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Change background",
        message: "Change the background to something new.",
      },
      {
        title: "Generate sonnet",
        message: "Write a short sonnet about AI.",
      },
    ],
    available: "always",
  });

  return { background };
}
