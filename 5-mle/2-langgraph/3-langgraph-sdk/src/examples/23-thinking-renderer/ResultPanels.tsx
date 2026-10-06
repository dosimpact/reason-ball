import { ShieldCheck } from "lucide-react";
import { type ThinkingRendererController } from "./useThinkingRenderer";

// Typed display panels receive only the state and callbacks they render.
type ThinkingStatusPanelProps = Pick<
  ThinkingRendererController,
  "finalStatus" | "thinkingSteps" | "safetyGuardrails" | "completedSteps"
>;

export function ThinkingStatusPanel({
  finalStatus,
  thinkingSteps,
  safetyGuardrails,
  completedSteps,
}: ThinkingStatusPanelProps) {
  return (
    <div
      className={`thinking-status-panel ${finalStatus}`}
      role="region"
      aria-label="Thinking Status"
    >
      <div className="panel-title">Thinking Status</div>
      <div className="thinking-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Public Steps</span>
          <strong>{thinkingSteps.length}</strong>
        </div>
        <div>
          <span>Completed</span>
          <strong>{completedSteps}</strong>
        </div>
        <div>
          <span>Public Only</span>
          <strong>{safetyGuardrails?.publicOnly ? "yes" : "pending"}</strong>
        </div>
      </div>
    </div>
  );
}

type ThinkingTimelinePanelProps = Pick<
  ThinkingRendererController,
  "status" | "thinkingSteps"
>;

export function ThinkingTimelinePanel({
  status,
  thinkingSteps,
}: ThinkingTimelinePanelProps) {
  return (
    <div
      className="thinking-timeline-panel"
      role="region"
      aria-label="Thinking Timeline"
    >
      <div className="panel-title">Thinking Timeline</div>
      <div className="thinking-step-list">
        {thinkingSteps.length === 0 ? (
          <p className="muted">
            Public thinking status blocks appear while the graph runs.
          </p>
        ) : (
          thinkingSteps.map((step) => (
            <details
              key={`${step.stepId}-${step.sequence}`}
              className={`thinking-step ${step.status}`}
              open
            >
              <summary>
                <strong>{step.label}</strong>
                <span>{step.status}</span>
              </summary>
              <p>{step.publicSummary}</p>
              <small>{step.detail}</small>
              <code>{step.publicOnly ? "public_only" : "not_public"}</code>
            </details>
          ))
        )}
      </div>
    </div>
  );
}

type PublicReasoningSummaryPanelProps = Pick<
  ThinkingRendererController,
  "reasoningSummary"
>;

export function PublicReasoningSummaryPanel({
  reasoningSummary,
}: PublicReasoningSummaryPanelProps) {
  return (
    <div
      className="reasoning-summary-panel"
      role="region"
      aria-label="Public Reasoning Summary"
    >
      <div className="panel-title">Public Reasoning Summary</div>
      <div className="answer-box compact-answer">
        {reasoningSummary ||
          "Public summary appears after the graph builds visible status notes."}
      </div>
    </div>
  );
}

type SafetyGuardrailsPanelProps = Pick<
  ThinkingRendererController,
  "safetyGuardrails"
>;

export function SafetyGuardrailsPanel({
  safetyGuardrails,
}: SafetyGuardrailsPanelProps) {
  return (
    <div
      className="guardrails-panel"
      role="region"
      aria-label="Safety Guardrails"
    >
      <div className="panel-title">
        <ShieldCheck aria-hidden="true" size={18} />
        Safety Guardrails
      </div>
      {safetyGuardrails ? (
        <div className="guardrail-card">
          <strong>{safetyGuardrails.policy}</strong>
          <dl>
            <div>
              <dt>Public only</dt>
              <dd>{safetyGuardrails.publicOnly ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt>Non-public notes exposed</dt>
              <dd>{safetyGuardrails.hiddenReasoningExposed ? "yes" : "no"}</dd>
            </div>
          </dl>
          <p>Allowed: {safetyGuardrails.allowedContent.join(", ")}</p>
          <p>Blocked: {safetyGuardrails.blockedContent.join(", ")}</p>
        </div>
      ) : (
        <p className="muted">Guardrails are loaded at run start.</p>
      )}
    </div>
  );
}

type FinalAnswerPanelProps = Pick<
  ThinkingRendererController,
  "answer" | "final"
>;

export function FinalAnswerPanel({ answer, final }: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box compact-answer">
        {final || answer || "No final answer yet."}
      </div>
    </div>
  );
}
