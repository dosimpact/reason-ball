import { AlertTriangle, GitBranch, ShieldCheck } from "lucide-react";
import { type RetryErrorDegradationController } from "./useRetryErrorDegradation";

// Typed display panels receive only the state and callbacks they render.
type RunStatusPanelProps = Pick<
  RetryErrorDegradationController,
  "finalStatus" | "retryStatus" | "currentAttempt" | "usedStrategy"
>;

export function RunStatusPanel({
  finalStatus,
  retryStatus,
  currentAttempt,
  usedStrategy,
}: RunStatusPanelProps) {
  return (
    <div
      className={`retry-status-panel ${finalStatus}`}
      role="region"
      aria-label="Run Status"
    >
      <div className="panel-title">
        <ShieldCheck aria-hidden="true" size={18} />
        Run Status
      </div>
      <div className="retry-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Retry Status</span>
          <strong>{retryStatus}</strong>
        </div>
        <div>
          <span>Used Strategy</span>
          <strong>{usedStrategy}</strong>
        </div>
        <div>
          <span>Current Attempt</span>
          <strong>{currentAttempt || "none"}</strong>
        </div>
      </div>
    </div>
  );
}

type RetryTimelinePanelProps = Pick<
  RetryErrorDegradationController,
  "status" | "attempts"
>;

export function RetryTimelinePanel({
  status,
  attempts,
}: RetryTimelinePanelProps) {
  return (
    <div
      className="retry-timeline-panel"
      role="region"
      aria-label="Retry Timeline"
    >
      <div className="panel-title">Retry Timeline</div>
      <div className="retry-attempt-grid">
        {attempts.length === 0 ? (
          <p className="muted">Run a mode to see attempts and backoff.</p>
        ) : (
          attempts.map((attempt) => (
            <article
              key={`${attempt.attempt}-${attempt.status}`}
              className={`retry-attempt-card ${attempt.status}`}
            >
              <div className="retry-attempt-header">
                <strong>Attempt {attempt.attempt}</strong>
                <span>{attempt.status}</span>
              </div>
              {attempt.errorType ? <code>{attempt.errorType}</code> : null}
              {attempt.message ? <p>{attempt.message}</p> : null}
              {attempt.backoffMs ? (
                <p>
                  <strong>Backoff:</strong> {attempt.backoffMs}ms
                </p>
              ) : null}
              {attempt.result ? <p>{attempt.result}</p> : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type ErrorDetailsPanelProps = Pick<RetryErrorDegradationController, "errors">;

export function ErrorDetailsPanel({ errors }: ErrorDetailsPanelProps) {
  return (
    <div
      className="error-details-panel"
      role="region"
      aria-label="Error Details"
    >
      <div className="panel-title">
        <AlertTriangle aria-hidden="true" size={18} />
        Error Details
      </div>
      <div className="error-record-list">
        {errors.length === 0 ? (
          <p className="muted">No structured errors yet.</p>
        ) : (
          errors.map((item) => (
            <article
              key={`${item.node}-${item.attempt}`}
              className={item.recoverable ? "recoverable" : "permanent"}
            >
              <strong>
                {item.errorType} attempt {item.attempt}
              </strong>
              <span>
                {item.recoverable ? "recoverable" : "not recoverable"}
              </span>
              <p>{item.message}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type FallbackResultPanelProps = Pick<
  RetryErrorDegradationController,
  "primaryResult" | "fallbackResult"
>;

export function FallbackResultPanel({
  primaryResult,
  fallbackResult,
}: FallbackResultPanelProps) {
  return (
    <div
      className="fallback-result-panel"
      role="region"
      aria-label="Fallback Result"
    >
      <div className="panel-title">
        <GitBranch aria-hidden="true" size={18} />
        Fallback Result
      </div>
      {fallbackResult ? (
        <div className="answer-box">{fallbackResult}</div>
      ) : primaryResult ? (
        <div className="answer-box">{primaryResult}</div>
      ) : (
        <p className="muted">Primary or fallback result will appear here.</p>
      )}
    </div>
  );
}

type RetryEventsPanelProps = Pick<
  RetryErrorDegradationController,
  "status" | "retryEvents"
>;

export function RetryEventsPanel({
  status,
  retryEvents,
}: RetryEventsPanelProps) {
  return (
    <div className="retry-events-panel" role="region" aria-label="Retry Events">
      <div className="panel-title">Retry Events</div>
      <div className="retry-event-list">
        {retryEvents.length === 0 ? (
          <p className="muted">Custom retry events will appear here.</p>
        ) : (
          retryEvents.map((event, index) => (
            <div
              key={`${event.phase}-${event.attempt}-${event.status}-${index}`}
              className={`retry-event ${event.status}`}
            >
              <strong>{event.phase}</strong>
              <span>attempt {event.attempt}</span>
              <code>{event.status}</code>
              <p>{event.detail}</p>
              {event.backoffMs ? (
                <small>backoff {event.backoffMs}ms</small>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type FinalAnswerPanelProps = Pick<RetryErrorDegradationController, "final">;

export function FinalAnswerPanel({ final }: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box">{final || "No final answer yet."}</div>
    </div>
  );
}
