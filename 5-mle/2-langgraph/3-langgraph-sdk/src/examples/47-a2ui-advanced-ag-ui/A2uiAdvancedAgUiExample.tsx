import "@copilotkit/react-core/v2/styles.css";
import "./a2ui-advanced-ag-ui.css";
import {
  CopilotChat,
  CopilotKit,
  useConfigureSuggestions,
  useFrontendTool,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { CheckCircle2, MousePointerClick, Rocket, Workflow } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

type JsonRecord = Record<string, unknown>;

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseResult(parsed);
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function AdvancedCard({
  result,
  actionResult,
  onConfirm,
}: {
  result: unknown;
  actionResult: string;
  onConfirm: (selectionId: string, selectionLabel: string) => void;
}) {
  const parsed = parseResult(result);
  const panel = isRecord(parsed.panel) ? parsed.panel : {};
  const progress = records(parsed.progress);
  const options = records(panel.options);
  const selected = options.find((option) => option.selected === true) ?? options[0];
  const selectionId = String(selected?.id ?? "approve-staged");
  const selectionLabel = String(selected?.label ?? "Approve staged launch");

  return (
    <article className="advanced-a2ui-card" data-testid="advanced-a2ui-card">
      <header className="advanced-a2ui-header">
        <Workflow size={18} aria-hidden="true" />
        <div>
          <strong>{String(panel.title ?? "Generated decision")}</strong>
          <span>{String(parsed.schema_version ?? "advanced-a2ui-v1")}</span>
        </div>
      </header>

      <div className="advanced-a2ui-progress">
        {progress.map((step) => (
          <section key={String(step.id ?? step.label)} className={String(step.status ?? "pending")}>
            <CheckCircle2 size={15} aria-hidden="true" />
            <div>
              <strong>{String(step.label ?? "Step")}</strong>
              <span>{String(step.detail ?? "")}</span>
            </div>
          </section>
        ))}
      </div>

      <section className="advanced-a2ui-decision">
        <p>{String(panel.summary ?? "Review the generated options.")}</p>
        <div className="advanced-a2ui-options">
          {options.map((option) => (
            <article key={String(option.id ?? option.label)} className={option.selected ? "selected" : ""}>
              <strong>{String(option.label ?? "Option")}</strong>
              <span>{String(option.impact ?? "")}</span>
            </article>
          ))}
        </div>
        <button type="button" onClick={() => onConfirm(selectionId, selectionLabel)}>
          <MousePointerClick size={15} aria-hidden="true" />
          Confirm recommended action
        </button>
      </section>

      <footer>{actionResult || String(parsed.final_summary ?? "Waiting for frontend action.")}</footer>
    </article>
  );
}

function Chat() {
  const [actionResult, setActionResult] = useState("");

  async function confirmSelection(selectionId: string, selectionLabel: string) {
    const message = `Confirmed ${selectionLabel} (${selectionId})`;
    setActionResult(message);
    return {
      status: "confirmed",
      selectionId,
      selectionLabel,
      message,
    };
  }

  useFrontendTool({
    name: "confirm_advanced_selection",
    description: "Confirm the selected option from the advanced A2UI decision panel.",
    parameters: z.object({
      selection_id: z.string().describe("Stable id for the selected option."),
      selection_label: z.string().describe("Human-readable selected option label."),
    }),
    handler: async ({
      selection_id: selectionId,
      selection_label: selectionLabel,
    }: {
      selection_id: string;
      selection_label: string;
    }) => confirmSelection(selectionId, selectionLabel),
  });

  useRenderTool({
    name: "build_advanced_a2ui",
    parameters: z.object({
      request: z.string().describe("The task that should produce advanced A2UI."),
    }),
    render: ({ result, status }) => {
      if (status !== "complete") {
        return <div className="advanced-a2ui-loading">Building advanced A2UI...</div>;
      }

      return (
        <AdvancedCard
          result={result}
          actionResult={actionResult}
          onConfirm={(selectionId, selectionLabel) => {
            void confirmSelection(selectionId, selectionLabel);
          }}
        />
      );
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Build decision UI",
        message: "Create an advanced A2UI release decision panel with progress and a frontend confirmation action.",
      },
      {
        title: "Incident review",
        message: "Build an advanced incident review UI with progress phases and a recommended action.",
      },
    ],
    available: "always",
  });

  return (
    <section className="advanced-a2ui-shell">
      <aside className="advanced-a2ui-side">
        <div className="advanced-a2ui-side-title">
          <Rocket size={18} aria-hidden="true" />
          Advanced A2UI
        </div>
        <p>Backend payloads provide progress, generated UI, and action metadata. The button records the confirmed intent.</p>
        <div className="advanced-a2ui-action-state">{actionResult || "No frontend action confirmed yet."}</div>
      </aside>
      <div className="advanced-a2ui-chat">
        <CopilotChat agentId="a2ui_advanced" className="advanced-a2ui-chat-window" />
      </div>
    </section>
  );
}

export function A2uiAdvancedAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="a2ui_advanced">
      <Chat />
    </CopilotKit>
  );
}
