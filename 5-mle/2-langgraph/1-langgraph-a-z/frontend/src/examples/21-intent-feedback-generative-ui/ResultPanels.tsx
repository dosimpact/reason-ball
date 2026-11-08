import { CheckCircle2 } from "lucide-react";
import { type IntentFeedbackGenerativeController } from "./useIntentFeedbackGenerative";

// Typed display panels receive only the state and callbacks they render.
type IntentStatusPanelProps = Pick<
  IntentFeedbackGenerativeController,
  "finalStatus" | "missing" | "uiRequests"
>;

export function IntentStatusPanel({
  finalStatus,
  missing,
  uiRequests,
}: IntentStatusPanelProps) {
  return (
    <div
      className={`intent-status-panel ${finalStatus}`}
      role="region"
      aria-label="Intent Status"
    >
      <div className="panel-title">Intent Status</div>
      <div className="intent-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Missing Fields</span>
          <strong>{missing.length ? missing.join(", ") : "none"}</strong>
        </div>
        <div>
          <span>UI Requests</span>
          <strong>{uiRequests.length}</strong>
        </div>
      </div>
    </div>
  );
}

type GeneratedUIRequestPanelProps = Pick<
  IntentFeedbackGenerativeController,
  "uiRequests" | "selection" | "busy" | "selectOption"
>;

export function GeneratedUIRequestPanel({
  uiRequests,
  selection,
  busy,
  selectOption,
}: GeneratedUIRequestPanelProps) {
  return (
    <div
      className="generated-ui-panel"
      role="region"
      aria-label="Generated UI Request"
    >
      <div className="panel-title">Generated UI Request</div>
      {uiRequests.length === 0 ? (
        <p className="muted">
          No generated controls are needed for a complete intent.
        </p>
      ) : (
        <div className="generated-ui-list">
          {uiRequests.map((request) => (
            <article key={request.id} className="generated-ui-card">
              <div>
                <strong>{request.title}</strong>
                <span>{request.type}</span>
              </div>
              <p>{request.description}</p>
              <div
                className="option-grid"
                role="radiogroup"
                aria-label={request.field}
              >
                {request.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selection[request.field] === option.value}
                    className={
                      selection[request.field] === option.value
                        ? "option-chip active"
                        : "option-chip"
                    }
                    onClick={() => selectOption(request.field, option.value)}
                    disabled={busy}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

type CompletedIntentPanelProps = Pick<
  IntentFeedbackGenerativeController,
  "intent" | "selection"
>;

export function CompletedIntentPanel({
  intent,
  selection,
}: CompletedIntentPanelProps) {
  return (
    <div
      className="completed-intent-panel"
      role="region"
      aria-label="Completed Intent"
    >
      <div className="panel-title">
        <CheckCircle2 aria-hidden="true" size={18} />
        Completed Intent
      </div>
      <div className="intent-detail-grid">
        <div>
          <span>Ticker</span>
          <strong>{intent?.ticker || selection.ticker || "missing"}</strong>
        </div>
        <div>
          <span>Market</span>
          <strong>{intent?.market || selection.market || "missing"}</strong>
        </div>
        <div>
          <span>Period</span>
          <strong>{intent?.period || selection.period || "missing"}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{intent?.source || "none"}</strong>
        </div>
      </div>
    </div>
  );
}

type QuoteSnapshotPanelProps = Pick<
  IntentFeedbackGenerativeController,
  "quoteSnapshot"
>;

export function QuoteSnapshotPanel({ quoteSnapshot }: QuoteSnapshotPanelProps) {
  return (
    <div
      className="quote-snapshot-panel"
      role="region"
      aria-label="Quote Snapshot"
    >
      <div className="panel-title">Quote Snapshot</div>
      {quoteSnapshot ? (
        <div className="quote-card">
          <strong>
            {quoteSnapshot.ticker} / {quoteSnapshot.market}
          </strong>
          <span>{quoteSnapshot.company}</span>
          <p>
            {quoteSnapshot.currency} {quoteSnapshot.price.toFixed(2)} (
            {quoteSnapshot.change >= 0 ? "+" : ""}
            {quoteSnapshot.change.toFixed(2)},{" "}
            {quoteSnapshot.changePercent.toFixed(2)}%)
          </p>
          <small>
            {quoteSnapshot.period} · {quoteSnapshot.asOf} ·{" "}
            {quoteSnapshot.source}
          </small>
        </div>
      ) : (
        <p className="muted">
          Quote snapshot appears after the intent is complete.
        </p>
      )}
    </div>
  );
}

type IntentEventsPanelProps = Pick<
  IntentFeedbackGenerativeController,
  "status" | "intentEvents"
>;

export function IntentEventsPanel({
  status,
  intentEvents,
}: IntentEventsPanelProps) {
  return (
    <div
      className="intent-events-panel"
      role="region"
      aria-label="Intent Events"
    >
      <div className="panel-title">Intent Events</div>
      <div className="intent-event-list">
        {intentEvents.length === 0 ? (
          <p className="muted">Intent and UI events will appear here.</p>
        ) : (
          intentEvents.map((event, index) => (
            <article
              key={`${event.phase}-${index}`}
              className={`intent-event ${event.status}`}
            >
              <strong>{event.phase}</strong>
              <code>{event.status}</code>
              <p>{event.detail}</p>
              {event.field ? <small>{event.field}</small> : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type FinalAnswerPanelProps = Pick<
  IntentFeedbackGenerativeController,
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
