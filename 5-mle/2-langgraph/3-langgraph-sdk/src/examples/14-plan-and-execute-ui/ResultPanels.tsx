import { CheckSquare, GitBranch, Square } from "lucide-react";
import { type PlanAndExecuteController } from "./usePlanAndExecute";

// Typed display panels receive only the state and callbacks they render.
type ExecutionStatusPanelProps = Pick<
  PlanAndExecuteController,
  "executionStatus" | "completedSteps" | "planVersion" | "activeStep"
>;

export function ExecutionStatusPanel({
  executionStatus,
  completedSteps,
  planVersion,
  activeStep,
}: ExecutionStatusPanelProps) {
  return (
    <div
      className={`execution-status-panel ${executionStatus}`}
      role="region"
      aria-label="Execution Status"
    >
      <div className="panel-title">
        <CheckSquare aria-hidden="true" size={18} />
        Execution Status
      </div>
      <div className="execution-status-grid">
        <div>
          <span>Execution</span>
          <strong>{executionStatus}</strong>
        </div>
        <div>
          <span>Active Step</span>
          <strong>{activeStep?.title || "none"}</strong>
        </div>
        <div>
          <span>Completed</span>
          <strong>{completedSteps.length}</strong>
        </div>
        <div>
          <span>Plan Version</span>
          <strong>{planVersion || "none"}</strong>
        </div>
      </div>
    </div>
  );
}

type ReplanStopControlsPanelProps = Pick<
  PlanAndExecuteController,
  "controlMode" | "replanned" | "stopped" | "stopReason"
>;

export function ReplanStopControlsPanel({
  controlMode,
  replanned,
  stopped,
  stopReason,
}: ReplanStopControlsPanelProps) {
  return (
    <div
      className="control-state-panel"
      role="region"
      aria-label="Replan / Stop Controls"
    >
      <div className="panel-title">
        <GitBranch aria-hidden="true" size={18} />
        Replan / Stop Controls
      </div>
      <div className="control-state-grid">
        <div>
          <span>Control Mode</span>
          <strong>{controlMode}</strong>
        </div>
        <div>
          <span>Replanned</span>
          <strong>{replanned ? "yes" : "no"}</strong>
        </div>
        <div>
          <span>Stopped</span>
          <strong>{stopped ? "yes" : "no"}</strong>
        </div>
      </div>
      {stopReason ? <p className="fallback-line">{stopReason}</p> : null}
    </div>
  );
}

type PlanStepsPanelProps = Pick<
  PlanAndExecuteController,
  "status" | "planSteps" | "error"
>;

export function PlanStepsPanel({
  status,
  planSteps,
  error,
}: PlanStepsPanelProps) {
  return (
    <div className="plan-steps-panel" role="region" aria-label="Plan Steps">
      <div className="panel-title">Plan Steps</div>
      <div className="plan-step-grid">
        {planSteps.length === 0 ? (
          <p className="muted">Run a task to see planner output.</p>
        ) : (
          planSteps.map((step) => (
            <article
              key={step.id}
              className={`plan-step-card ${step.status}`}
              data-step-id={step.id}
              data-status={step.status}
            >
              <div className="plan-step-header">
                <strong>
                  {step.index}. {step.title}
                </strong>
                <span>{step.status}</span>
              </div>
              <code>
                {step.id} / {step.source}
              </code>
              {step.result ? (
                <p>
                  <strong>Result:</strong> {step.result}
                </p>
              ) : null}
              {step.error ? (
                <p>
                  <strong>Note:</strong> {step.error}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type ExecutorOutputPanelProps = Pick<
  PlanAndExecuteController,
  "status" | "completedSteps" | "error"
>;

export function ExecutorOutputPanel({
  status,
  completedSteps,
  error,
}: ExecutorOutputPanelProps) {
  return (
    <div
      className="executor-output-panel"
      role="region"
      aria-label="Executor Output"
    >
      <div className="panel-title">Executor Output</div>
      {completedSteps.length === 0 ? (
        <p className="muted">Completed step results will appear here.</p>
      ) : (
        <ol className="completed-step-list">
          {completedSteps.map((step) => (
            <li key={step.id}>
              <strong>{step.title}</strong>
              <span>{step.status}</span>
              <p>{step.result || step.error}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type StepEventsPanelProps = Pick<
  PlanAndExecuteController,
  "status" | "stepEvents"
>;

export function StepEventsPanel({ status, stepEvents }: StepEventsPanelProps) {
  return (
    <div className="step-events-panel" role="region" aria-label="Step Events">
      <div className="panel-title">Step Events</div>
      <div className="step-event-list">
        {stepEvents.length === 0 ? (
          <p className="muted">No step events yet.</p>
        ) : (
          stepEvents.slice(0, 12).map((event, index) => (
            <div
              key={`${event.stepId}-${event.status}-${index}`}
              className={`step-event ${event.status}`}
            >
              <Square aria-hidden="true" size={12} />
              <strong>{event.status}</strong>
              <span>{event.title}</span>
              <p>{event.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type FinalAnswerPanelProps = Pick<PlanAndExecuteController, "finalAnswer">;

export function FinalAnswerPanel({ finalAnswer }: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box">{finalAnswer || "No final answer yet."}</div>
    </div>
  );
}
