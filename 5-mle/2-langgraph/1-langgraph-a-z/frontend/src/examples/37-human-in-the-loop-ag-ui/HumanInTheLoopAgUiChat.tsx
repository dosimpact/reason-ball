import { CopilotChat } from "@copilotkit/react-core/v2";
import { Check, ClipboardCheck, Pencil, ShieldAlert, X } from "lucide-react";
import { useHumanInTheLoopAgUiChat } from "./useHumanInTheLoopAgUiChat";
import { styles } from "./styles";
import { fromStepText } from "./model";

export function HumanInTheLoopAgUiChat() {
  const { pending, draftSteps, setDraftSteps, lastDecision, resolveApproval } = useHumanInTheLoopAgUiChat();

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
        <CopilotChat agentId="37_human_in_the_loop_ag_ui" className="agentic-chat-window" />
      </div>
    </section>
  );
}
