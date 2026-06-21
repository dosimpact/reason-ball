import { useRef, useState } from "react";
import "@copilotkit/react-core/v2/styles.css";
import {
  CopilotChat,
  CopilotKit,
  useConfigureSuggestions,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { Check, ClipboardCheck, Pencil, ShieldAlert, X } from "lucide-react";
import { z } from "zod";

type ApprovalDecision = {
  decision: "approved" | "edited_and_approved" | "rejected";
  steps: string[];
  note: string;
};

type ApprovalRequest = {
  title: string;
  steps: string[];
  riskNote: string;
  action?: string;
};

type PendingApproval = ApprovalRequest & {
  id: string;
};

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

const styles = {
  shell: {
    display: "grid",
    minHeight: "640px",
    gridTemplateColumns: "minmax(340px, 0.8fr) minmax(0, 1.2fr)",
    border: "1px solid #d8dee8",
    borderRadius: "8px",
    overflow: "hidden",
    background: "#f6f7f9",
  },
  side: {
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
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 700,
    color: "#17202a",
  },
  panel: {
    display: "grid",
    gap: "12px",
    border: "1px solid #cbd7e3",
    borderRadius: "8px",
    padding: "14px",
    background: "#f9fbfd",
  },
  textarea: {
    minHeight: "120px",
    resize: "vertical" as const,
    border: "1px solid #cbd7e3",
    borderRadius: "8px",
    padding: "10px",
    font: "inherit",
    color: "#17202a",
  },
  row: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #cbd7e3",
    borderRadius: "8px",
    padding: "8px 10px",
    background: "#ffffff",
    color: "#17202a",
    cursor: "pointer",
    font: "inherit",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #1f6feb",
    borderRadius: "8px",
    padding: "8px 10px",
    background: "#1f6feb",
    color: "#ffffff",
    cursor: "pointer",
    font: "inherit",
  },
  rejectedButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #d1242f",
    borderRadius: "8px",
    padding: "8px 10px",
    background: "#ffffff",
    color: "#b4232d",
    cursor: "pointer",
    font: "inherit",
  },
  empty: {
    border: "1px dashed #cbd7e3",
    borderRadius: "8px",
    padding: "14px",
    color: "#5f6b7a",
  },
};

function toStepText(steps: string[]) {
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function fromStepText(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function HumanInTheLoopChat() {
  const resolverRef = useRef<((decision: ApprovalDecision) => void) | null>(null);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [draftSteps, setDraftSteps] = useState("");
  const [lastDecision, setLastDecision] = useState<ApprovalDecision | null>(null);

  function resolveApproval(decision: ApprovalDecision) {
    resolverRef.current?.(decision);
    resolverRef.current = null;
    setLastDecision(decision);
    setPending(null);
  }

  useFrontendTool({
    name: "request_task_approval",
    description: "Ask the human to approve, reject, or edit a proposed task plan before continuing.",
    parameters: z.object({
      title: z.string(),
      steps: z.array(z.string()).min(1),
      riskNote: z.string(),
      action: z.string().optional(),
    }),
    handler: async ({ title, steps, riskNote, action }: ApprovalRequest) => {
      setPending({ id: `${Date.now()}`, title, steps, riskNote, action });
      setDraftSteps(toStepText(steps));
      setLastDecision(null);

      return new Promise<ApprovalDecision>((resolve) => {
        resolverRef.current = resolve;
      });
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Approve a rollout",
        message: "Draft a three step rollout plan for enabling AG-UI backend tool cards.",
      },
      {
        title: "Review a publish plan",
        message: "Prepare a plan to publish the deterministic haiku card demo.",
      },
    ],
    available: "always",
  });

  return (
    <section style={styles.shell}>
      <aside style={styles.side}>
        <div style={styles.title}>
          <ShieldAlert aria-hidden="true" size={18} />
          Approval Console
        </div>
        {pending ? (
          <div style={styles.panel} data-testid="ag-ui-approval-panel">
            <strong>{pending.title}</strong>
            <span>{pending.riskNote}</span>
            <textarea
              aria-label="Editable approval steps"
              style={styles.textarea}
              value={draftSteps}
              onChange={(event) => setDraftSteps(event.target.value)}
            />
            <div style={styles.row}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() =>
                  resolveApproval({
                    decision: "approved",
                    steps: pending.steps,
                    note: "Approved without edits.",
                  })
                }
              >
                <Check aria-hidden="true" size={16} />
                Approve
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={() =>
                  resolveApproval({
                    decision: "edited_and_approved",
                    steps: fromStepText(draftSteps),
                    note: "Approved with edited steps.",
                  })
                }
              >
                <Pencil aria-hidden="true" size={16} />
                Edit and Approve
              </button>
              <button
                type="button"
                style={styles.rejectedButton}
                onClick={() =>
                  resolveApproval({
                    decision: "rejected",
                    steps: [],
                    note: "Rejected by the human reviewer.",
                  })
                }
              >
                <X aria-hidden="true" size={16} />
                Reject
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.empty} data-testid="ag-ui-approval-empty">
            No approval is pending. Ask the agent to draft or execute a plan.
          </div>
        )}
        {lastDecision ? (
          <div style={styles.panel} data-testid="ag-ui-approval-result">
            <div style={styles.title}>
              <ClipboardCheck aria-hidden="true" size={16} />
              Last decision
            </div>
            <strong>{lastDecision.decision.replaceAll("_", " ")}</strong>
            <span>{lastDecision.note}</span>
          </div>
        ) : null}
      </aside>
      <div style={styles.chat}>
        <CopilotChat agentId="human_in_the_loop_ag_ui" className="agentic-chat-window" />
      </div>
    </section>
  );
}

export function HumanInTheLoopAgUiExample() {
  return (
    <CopilotKit
      runtimeUrl={copilotRuntimeUrl()}
      showDevConsole={false}
      agent="human_in_the_loop_ag_ui"
    >
      <HumanInTheLoopChat />
    </CopilotKit>
  );
}
