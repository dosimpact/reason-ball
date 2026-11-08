import { Check, SquarePen, X } from "lucide-react";

import type { useHumanInTheLoopInterrupt } from "./useHumanInTheLoopInterrupt";

export function ResultsPanel({
  resultText,
}: Pick<ReturnType<typeof useHumanInTheLoopInterrupt>, "resultText">) {
  return (
    <div
      className="result-panel interrupt-result"
      role="region"
      aria-label="Decision Result"
    >
      <div className="panel-title">Decision Result</div>
      <div className="answer-box">
        {resultText || "No decision result yet."}
      </div>
    </div>
  );
}

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useHumanInTheLoopInterrupt>, "events">) {
  return (
    <div className="event-panel" role="region" aria-label="Raw Stream Events">
      <div className="panel-title">Raw Stream Events</div>
      <div className="event-list compact">
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          events.map((entry) => (
            <details key={entry.id} className="event-row">
              <summary>
                <span>{entry.receivedAt}</span>
                <strong>{entry.event}</strong>
              </summary>
              <pre>{JSON.stringify(entry.data, null, 2)}</pre>
            </details>
          ))
        )}
      </div>
    </div>
  );
}

export function InterruptApprovalPayloadView({
  action,
  editText,
  setEditText,
  interruptPayload,
  busy,
  resumeRun,
}: Pick<
  ReturnType<typeof useHumanInTheLoopInterrupt>,
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
      aria-label="Interrupt approval payload"
    >
      <div className="panel-title">Interrupt Approval Payload</div>
      {interruptPayload ? (
        <div className="approval-card">
          <div className="approval-header">
            <strong>{interruptPayload.question ?? "Approval required"}</strong>
            <span>{interruptPayload.risk ?? "unknown"} risk</span>
          </div>
          <dl className="approval-details">
            <div>
              <dt>Action</dt>
              <dd>{interruptPayload.action}</dd>
            </div>
            <div>
              <dt>Risk Summary</dt>
              <dd>{interruptPayload.risk_summary}</dd>
            </div>
          </dl>
          <label className="field">
            <span>Edited Action</span>
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
              onClick={() => void resumeRun("approve")}
              disabled={busy}
            >
              <Check size={16} />
              Approve
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void resumeRun({ action: "edit", action_text: editText })
              }
              disabled={busy || !editText.trim()}
            >
              <SquarePen size={16} />
              Approve edited action
            </button>
            <button
              type="button"
              className="secondary-button danger"
              onClick={() => void resumeRun("reject")}
              disabled={busy}
            >
              <X size={16} />
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">
          Start a high-risk action to pause at an approval interrupt.
        </p>
      )}
    </div>
  );
}

export function FinalStateView({
  finalState,
}: Pick<ReturnType<typeof useHumanInTheLoopInterrupt>, "finalState">) {
  return (
    <div
      className="state-panel interrupt-state"
      role="region"
      aria-label="Final State"
    >
      <div className="panel-title">Final State</div>
      <pre>
        {finalState ? JSON.stringify(finalState, null, 2) : "No state yet."}
      </pre>
    </div>
  );
}
