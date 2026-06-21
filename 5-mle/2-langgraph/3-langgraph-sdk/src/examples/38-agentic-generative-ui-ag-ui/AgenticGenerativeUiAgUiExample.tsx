import "@copilotkit/react-core/v2/styles.css";
import { CopilotChat, CopilotKit, useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { CheckCircle2, CircleDashed, FileText, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";

type WorkspaceChecklistItem = {
  label?: string;
  state?: string;
};

type WorkspaceSection = {
  heading?: string;
  content?: string;
};

type WorkspacePayload = {
  title?: string;
  status?: string;
  activeStep?: string;
  progress?: number;
  checklist?: WorkspaceChecklistItem[];
  sections?: WorkspaceSection[];
  summary?: string;
};

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function normalizeWorkspace(result: unknown): WorkspacePayload {
  if (typeof result === "string") {
    try {
      return normalizeWorkspace(JSON.parse(result));
    } catch {
      return {};
    }
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as WorkspacePayload;
  }

  return {};
}

const styles = {
  shell: {
    display: "grid",
    minHeight: "640px",
    gridTemplateColumns: "minmax(360px, 0.9fr) minmax(0, 1.1fr)",
    border: "1px solid #d8dee8",
    borderRadius: "8px",
    overflow: "hidden",
    background: "#f6f7f9",
  },
  preview: {
    display: "grid",
    alignContent: "start",
    gap: "14px",
    borderRight: "1px solid #d8dee8",
    padding: "18px",
    background: "#ffffff",
  },
  chat: {
    minHeight: "640px",
  },
  card: {
    display: "grid",
    gap: "14px",
    border: "1px solid #cbd7e3",
    borderRadius: "8px",
    padding: "16px",
    background: "#ffffff",
    color: "#17202a",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 700,
  },
  progressTrack: {
    height: "10px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#e8edf3",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#2f7d62",
  },
  checklist: {
    display: "grid",
    gap: "8px",
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #e4e9ef",
    borderRadius: "8px",
    padding: "8px",
    background: "#f9fbfd",
  },
  section: {
    display: "grid",
    gap: "6px",
    borderTop: "1px solid #edf1f5",
    paddingTop: "10px",
  },
  empty: {
    border: "1px dashed #cbd7e3",
    borderRadius: "8px",
    padding: "14px",
    color: "#5f6b7a",
  },
};

function WorkspaceCard({ result }: { result: unknown }) {
  const parsed = normalizeWorkspace(result);
  const checklist = parsed.checklist ?? [];
  const sections = parsed.sections ?? [];
  const progress = typeof parsed.progress === "number" ? parsed.progress : 0;

  return (
    <div style={styles.card} data-testid="agentic-generative-workspace">
      <div style={styles.title}>
        <Sparkles aria-hidden="true" size={18} />
        {parsed.title ?? "Generated task workspace"}
      </div>
      <span>Active step: {parsed.activeStep ?? parsed.status ?? "working"}</span>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${Math.max(0, Math.min(progress, 100))}%` }} />
      </div>
      <div style={styles.checklist}>
        {checklist.map((item) => (
          <div key={item.label} style={styles.step}>
            {item.state === "complete" ? (
              <CheckCircle2 aria-hidden="true" size={16} />
            ) : (
              <CircleDashed aria-hidden="true" size={16} />
            )}
            <span>{item.label ?? "Workspace step"}</span>
          </div>
        ))}
      </div>
      {sections.map((section) => (
        <div key={section.heading} style={styles.section}>
          <strong>{section.heading ?? "Section"}</strong>
          <span>{section.content ?? ""}</span>
        </div>
      ))}
      <strong>{parsed.summary ?? "Workspace update received."}</strong>
    </div>
  );
}

function AgenticGenerativeChat() {
  useRenderTool({
    name: "build_task_workspace",
    parameters: z.object({
      request: z.string(),
    }),
    render: ({ parameters, result, status }) => {
      if (status !== "complete") {
        return (
          <div style={styles.card} data-testid="agentic-generative-loading">
            <div style={styles.title}>
              <Loader2 aria-hidden="true" size={18} />
              Building workspace
            </div>
            <span>{parameters.request}</span>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: "45%" }} />
            </div>
          </div>
        );
      }

      return <WorkspaceCard result={result} />;
    },
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

  return (
    <section style={styles.shell}>
      <aside style={styles.preview}>
        <div style={styles.title}>
          <FileText aria-hidden="true" size={18} />
          Generated Workspace
        </div>
        <div style={styles.empty}>The latest backend workspace payload renders here during tool execution.</div>
      </aside>
      <div style={styles.chat}>
        <CopilotChat agentId="agentic_generative_ui" className="agentic-chat-window" />
      </div>
    </section>
  );
}

export function AgenticGenerativeUiAgUiExample() {
  return (
    <CopilotKit
      runtimeUrl={copilotRuntimeUrl()}
      showDevConsole={false}
      agent="agentic_generative_ui"
    >
      <AgenticGenerativeChat />
    </CopilotKit>
  );
}
