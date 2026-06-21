import "@copilotkit/react-core/v2/styles.css";
import { CopilotChat, CopilotKit, useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { Feather, Loader2, Palette } from "lucide-react";
import { z } from "zod";

type HaikuPalette = {
  background?: string;
  accent?: string;
  text?: string;
};

type HaikuPayload = {
  topic?: string;
  mood?: string;
  palette?: HaikuPalette;
  lines?: string[];
  explanation?: string;
};

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function normalizeHaiku(result: unknown): HaikuPayload {
  if (typeof result === "string") {
    try {
      return normalizeHaiku(JSON.parse(result));
    } catch {
      return {};
    }
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as HaikuPayload;
  }

  return {};
}

const styles = {
  surface: {
    display: "grid",
    minHeight: "640px",
    gridTemplateColumns: "minmax(0, 1fr)",
    background: "#f6f7f9",
    border: "1px solid #d8dee8",
    borderRadius: "8px",
    overflow: "hidden",
  },
  chatPanel: {
    minHeight: "640px",
  },
  card: {
    display: "grid",
    gap: "14px",
    border: "1px solid #d9c9a7",
    borderRadius: "8px",
    padding: "18px",
    color: "#1d2b2a",
    boxShadow: "0 8px 24px rgba(20, 35, 52, 0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 700,
  },
  mood: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid currentColor",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "12px",
    textTransform: "capitalize" as const,
  },
  poem: {
    display: "grid",
    gap: "8px",
    fontSize: "18px",
    lineHeight: 1.5,
  },
  fallback: {
    border: "1px dashed #cbd7e3",
    borderRadius: "8px",
    padding: "12px",
    background: "#ffffff",
    color: "#5f6b7a",
  },
};

function HaikuCard({ result }: { result: unknown }) {
  const parsed = normalizeHaiku(result);
  const lines = parsed.lines ?? [];
  const palette = parsed.palette ?? {};
  const background = palette.background ?? "#f7efe2";
  const accent = palette.accent ?? "#256f68";
  const text = palette.text ?? "#1d2b2a";

  if (lines.length === 0) {
    return (
      <div style={styles.fallback} data-testid="haiku-card-fallback">
        Tool returned an incomplete haiku payload.
      </div>
    );
  }

  return (
    <div
      style={{ ...styles.card, background, color: text }}
      data-testid="tool-based-generative-haiku-card"
    >
      <div style={styles.header}>
        <div style={styles.title}>
          <Feather aria-hidden="true" size={18} color={accent} />
          {parsed.topic ?? "Generated haiku"}
        </div>
        <span style={{ ...styles.mood, color: accent }}>
          <Palette aria-hidden="true" size={14} />
          {parsed.mood ?? "calm"}
        </span>
      </div>
      <div style={styles.poem}>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
      <span>{parsed.explanation ?? "Generated from a backend tool payload."}</span>
    </div>
  );
}

function ToolBasedGenerativeChat() {
  useRenderTool({
    name: "generate_haiku_card",
    parameters: z.object({
      topic: z.string(),
      mood: z.string().optional(),
    }),
    render: ({ parameters, result, status }) => {
      if (status !== "complete") {
        return (
          <div style={{ ...styles.card, background: "#ffffff" }} data-testid="haiku-card-loading">
            <div style={styles.title}>
              <Loader2 aria-hidden="true" size={18} />
              Generating haiku card
            </div>
            <span>{parameters.topic}</span>
          </div>
        );
      }

      return <HaikuCard result={result} />;
    },
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

  return (
    <section style={styles.surface}>
      <div style={styles.chatPanel}>
        <CopilotChat agentId="tool_based_generative_ui" className="agentic-chat-window" />
      </div>
    </section>
  );
}

export function ToolBasedGenerativeUiAgUiExample() {
  return (
    <CopilotKit
      runtimeUrl={copilotRuntimeUrl()}
      showDevConsole={false}
      agent="tool_based_generative_ui"
    >
      <ToolBasedGenerativeChat />
    </CopilotKit>
  );
}
