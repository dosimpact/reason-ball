import { useState } from "react";
import "@copilotkit/react-core/v2/styles.css";
import {
  CopilotChat,
  CopilotKit,
  useAgentContext,
  useConfigureSuggestions,
  useFrontendTool,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";

type WeatherResult = {
  city?: string;
  temperature?: number | string;
  humidity?: number | string;
  windSpeed?: number | string;
  wind_speed?: number | string;
  conditions?: string;
};

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function normalizeWeatherResult(result: unknown): WeatherResult {
  if (typeof result === "string") {
    try {
      const parsed: unknown = JSON.parse(result);
      return normalizeWeatherResult(parsed);
    } catch {
      return {};
    }
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as WeatherResult;
  }

  return {};
}

function Chat() {
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
    parameters: z.object({
      location: z.string(),
    }),
    render: ({ parameters, result, status }) => {
      if (status !== "complete") {
        return <div data-testid="weather-info-loading">Loading weather...</div>;
      }

      const parsed = normalizeWeatherResult(result);

      return (
        <div className="agentic-weather-card" data-testid="weather-info">
          <strong>Weather in {parsed.city ?? parameters.location}</strong>
          <div>Temperature: {parsed.temperature ?? "n/a"}&deg;C</div>
          <div>Humidity: {parsed.humidity ?? "n/a"}%</div>
          <div>Wind Speed: {parsed.windSpeed ?? parsed.wind_speed ?? "n/a"} mph</div>
          <div>Conditions: {parsed.conditions ?? "n/a"}</div>
        </div>
      );
    },
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

  return (
    <section
      className="agentic-chat-surface"
      data-testid="background-container"
      style={{ background }}
    >
      <div className="agentic-chat-panel">
        <CopilotChat agentId="agentic_chat" className="agentic-chat-window" />
      </div>
    </section>
  );
}

export function AgenticChatAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="agentic_chat">
      <Chat />
    </CopilotKit>
  );
}
