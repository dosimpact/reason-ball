import { Check, Loader2, ShieldAlert, SquarePen, X } from "lucide-react";
import type { useHumanInTheLoopReactHook } from "./useHumanInTheLoopReactHook";

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useHumanInTheLoopReactHook>, "events">) {
  return (
    <div
      className="event-panel"
      role="region"
      aria-label="React hook stream events"
    >
      <div className="panel-title">
        <Loader2 aria-hidden="true" size={18} />
        Hook Callbacks
      </div>
      <div className="event-list">
        {events.map((event) => (
          <article key={event.id} className="event-item">
            <header>
              <strong>{event.event}</strong>
              <span>{event.receivedAt}</span>
            </header>
            <pre>{JSON.stringify(event.data, null, 2)}</pre>
          </article>
        ))}
        {events.length === 0 ? (
          <p className="muted">No hook callback events yet.</p>
        ) : null}
      </div>
    </div>
  );
}

export function ResultsPanel({
  resultText,
}: Pick<ReturnType<typeof useHumanInTheLoopReactHook>, "resultText">) {
  return (
    <div
      className="result-panel interrupt-result"
      role="region"
      aria-label="Hook decision result"
    >
      <div className="panel-title">Decision Result</div>
      <strong>{resultText || "Waiting for decision"}</strong>
    </div>
  );
}

export function ReactHookInterruptPayloadView({
  action,
  editText,
  setEditText,
  interruptPayload,
  busy,
  resumeRun,
}: Pick<
  ReturnType<typeof useHumanInTheLoopReactHook>,
  | "action"
  | "editText"
  | "setEditText"
  | "interruptPayload"
  | "busy"
  | "resumeRun"
>) {
  return (
    <div
      className="interrupt-panel"
      role="region"
      aria-label="React hook interrupt payload"
    >
      <div className="panel-title">
        <ShieldAlert aria-hidden="true" size={18} />
        Interrupt Projection
      </div>

      {interruptPayload ? (
        <div className="approval-card">
          <div className="approval-card-header">
            <strong>{interruptPayload.question ?? "Approval required"}</strong>
            <span>{interruptPayload.risk ?? "unknown"} risk</span>
          </div>
          <dl>
            <dt>Action</dt>
            <dd>{interruptPayload.action}</dd>
            <dt>Risk summary</dt>
            <dd>{interruptPayload.risk_summary}</dd>
          </dl>
          <label className="field">
            <span>Edit action</span>
            <textarea
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              rows={3}
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void resumeRun("approve")}
            >
              <Check size={16} />
              Approve
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || !editText.trim()}
              onClick={() =>
                void resumeRun({ action: "edit", action_text: editText.trim() })
              }
            >
              <SquarePen size={16} />
              Edit
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => void resumeRun("reject")}
            >
              <X size={16} />
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">
          Start a high-risk action to read the interrupt through useStream.
        </p>
      )}
    </div>
  );
}

export function HookFinalStateView({
  values,
}: Pick<ReturnType<typeof useHumanInTheLoopReactHook>, "values">) {
  return (
    <div
      className="state-panel interrupt-state"
      role="region"
      aria-label="Hook final state"
    >
      <div className="panel-title">State Values</div>
      <pre>{JSON.stringify(values, null, 2)}</pre>
    </div>
  );
}
