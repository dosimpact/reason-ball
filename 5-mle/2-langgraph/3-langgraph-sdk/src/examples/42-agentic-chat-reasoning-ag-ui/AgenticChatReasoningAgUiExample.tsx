import { useState } from "react";
import "@copilotkit/react-core/v2/styles.css";
import {
  CopilotChat,
  CopilotKit,
  useConfigureSuggestions,
  useFrontendTool,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { Brain, CheckCircle2, ListChecks } from "lucide-react";
import { z } from "zod";

type ReasoningStatus = {
  id: string;
  label: string;
  detail: string;
};

const layoutStyle = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(300px, 0.85fr) minmax(380px, 1.15fr)",
  minHeight: 720,
} as const;

const panelStyle = {
  background: "#fbfcfb",
  border: "1px solid #cfd8d5",
  borderRadius: 8,
  display: "grid",
  gap: 14,
  padding: 16,
} as const;

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function parseJson(result: unknown): Record<string, unknown> {
  if (typeof result === "string") {
    try {
      const parsed: unknown = JSON.parse(result);
      return parseJson(parsed);
    } catch {
      return { text: result };
    }
  }
  if (result && typeof result === "object" && !Array.isArray(result)) return result as Record<string, unknown>;
  return {};
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function ReasoningChat() {
  const [statuses, setStatuses] = useState<ReasoningStatus[]>([
    {
      id: "seed",
      label: "Ready",
      detail: "Public reasoning summaries will appear as tool-rendered blocks.",
    },
  ]);

  useFrontendTool(
    {
      name: "record_reasoning_status",
      description: "Record a concise public reasoning status in the side panel.",
      parameters: z.object({
        label: z.string(),
        detail: z.string(),
      }),
      handler: async ({ label, detail }) => {
        setStatuses((current) => [{ id: `status-${current.length + 1}`, label, detail }, ...current].slice(0, 5));
        return { status: "recorded", label, detail };
      },
    },
    [],
  );

  useRenderTool({
    name: "publish_reasoning_summary",
    parameters: z.object({
      task: z.string(),
    }),
    render: ({ status, parameters, result }) => {
      const parsed = parseJson(result);
      const steps = stringList(parsed.steps);
      return (
        <details open style={{ ...panelStyle, gap: 10 }} data-testid="reasoning-summary-tool">
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>
            {status === "complete" ? "Public reasoning summary" : "Preparing public reasoning summary"}
          </summary>
          <span>{parameters.task || "Waiting for task..."}</span>
          {steps.length > 0 ? (
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          {typeof parsed.safety_note === "string" ? <small>{parsed.safety_note}</small> : null}
        </details>
      );
    },
  });

  useRenderTool({
    name: "lookup_policy_fact",
    parameters: z.object({
      topic: z.string(),
    }),
    render: ({ status, parameters, result }) => {
      const parsed = parseJson(result);
      return (
        <div style={{ ...panelStyle, gap: 8 }} data-testid="policy-fact-tool">
          <strong>{status === "complete" ? "Reasoning policy fact" : "Looking up policy fact"}</strong>
          <span>{parameters.topic || "pending"}</span>
          {typeof parsed.fact === "string" ? <p style={{ margin: 0 }}>{parsed.fact}</p> : null}
        </div>
      );
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Show reasoning summary",
        message: "Use publish_reasoning_summary for planning a safe AG-UI reasoning answer, then give the final answer separately.",
      },
      {
        title: "Policy fact",
        message: "Look up the reasoning UI policy fact and explain why hidden chain-of-thought is not displayed.",
      },
    ],
    available: "always",
  });

  return (
    <section style={layoutStyle}>
      <aside style={panelStyle} data-testid="reasoning-status-panel">
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <Brain size={18} />
          <h3 style={{ fontSize: 18, margin: 0 }}>Reasoning Status</h3>
        </div>
        <div style={{ ...panelStyle, background: "#f4faf7" }}>
          <strong>Visible Contract</strong>
          <span>Public summaries and tool activity are visible. Hidden chain-of-thought is not requested.</span>
        </div>
        {statuses.map((item) => (
          <article key={item.id} style={{ borderTop: "1px solid #d7dfdc", paddingTop: 10 }}>
            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
              <CheckCircle2 color="#20745c" size={16} />
              <strong>{item.label}</strong>
            </div>
            <p style={{ margin: "6px 0 0" }}>{item.detail}</p>
          </article>
        ))}
      </aside>

      <div style={{ ...panelStyle, minHeight: 680 }}>
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <ListChecks size={18} />
          <h3 style={{ fontSize: 18, margin: 0 }}>Reasoning Chat</h3>
        </div>
        <CopilotChat agentId="agentic_chat_reasoning" className="agentic-chat-window" />
      </div>
    </section>
  );
}

export function AgenticChatReasoningAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="agentic_chat_reasoning">
      <ReasoningChat />
    </CopilotKit>
  );
}
