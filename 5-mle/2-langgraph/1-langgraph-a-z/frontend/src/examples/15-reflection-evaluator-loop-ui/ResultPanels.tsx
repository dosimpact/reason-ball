import { CheckCircle2, GitCompareArrows, Square } from "lucide-react";
import { type ReflectionEvaluatorLoopController } from "./useReflectionEvaluatorLoop";

// Typed display panels receive only the state and callbacks they render.
type LoopStatusPanelProps = Pick<
  ReflectionEvaluatorLoopController,
  | "maxAttempts"
  | "loopStatus"
  | "currentIteration"
  | "verdict"
  | "score"
  | "stopReason"
>;

export function LoopStatusPanel({
  maxAttempts,
  loopStatus,
  currentIteration,
  verdict,
  score,
  stopReason,
}: LoopStatusPanelProps) {
  return (
    <div
      className={`loop-status-panel ${loopStatus}`}
      role="region"
      aria-label="Loop Status"
    >
      <div className="panel-title">
        <CheckCircle2 aria-hidden="true" size={18} />
        Loop Status
      </div>
      <div className="loop-status-grid">
        <div>
          <span>Loop</span>
          <strong>{loopStatus}</strong>
        </div>
        <div>
          <span>Current Iteration</span>
          <strong>{currentIteration || "none"}</strong>
        </div>
        <div>
          <span>Max Attempts</span>
          <strong>{maxAttempts}</strong>
        </div>
        <div>
          <span>Verdict</span>
          <strong>{verdict || "pending"}</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>{score ? `${score}/5` : "pending"}</strong>
        </div>
      </div>
      {stopReason ? <p className="final-line">{stopReason}</p> : null}
    </div>
  );
}

type EvaluatorFeedbackPanelProps = Pick<
  ReflectionEvaluatorLoopController,
  "verdict" | "score" | "feedback" | "requiredChanges"
>;

export function EvaluatorFeedbackPanel({
  verdict,
  score,
  feedback,
  requiredChanges,
}: EvaluatorFeedbackPanelProps) {
  return (
    <div
      className="evaluator-panel"
      role="region"
      aria-label="Evaluator Feedback"
    >
      <div className="panel-title">Evaluator Feedback</div>
      <div className="feedback-card">
        <span>{verdict || "pending"}</span>
        <strong>{score ? `Score ${score}/5` : "No score yet"}</strong>
        <p>{feedback || "Run the loop to see evaluator feedback."}</p>
      </div>
      {requiredChanges.length > 0 ? (
        <ul className="required-change-list">
          {requiredChanges.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type IterationHistoryPanelProps = Pick<
  ReflectionEvaluatorLoopController,
  "iterations" | "draft" | "verdict" | "score" | "feedback" | "requiredChanges"
>;

export function IterationHistoryPanel({
  iterations,
  draft,
  verdict,
  score,
  feedback,
  requiredChanges,
}: IterationHistoryPanelProps) {
  return (
    <div
      className="iteration-history-panel"
      role="region"
      aria-label="Iteration History"
    >
      <div className="panel-title">Iteration History</div>
      <div className="iteration-card-grid">
        {iterations.length === 0 ? (
          <p className="muted">
            Iteration cards will appear after the evaluator runs.
          </p>
        ) : (
          iterations.map((iteration) => (
            <article
              key={iteration.iteration}
              className={`iteration-card ${iteration.verdict.toLowerCase() || "pending"}`}
            >
              <div className="iteration-card-header">
                <strong>Attempt {iteration.iteration}</strong>
                <span>Verdict {iteration.verdict || "pending"}</span>
              </div>
              <strong>Score {iteration.score || 0}/5</strong>
              <div
                className="score-meter"
                aria-label={`Score ${iteration.score} out of 5`}
              >
                <div
                  style={{ width: `${Math.max(iteration.score, 0) * 20}%` }}
                />
              </div>
              <p>
                <strong>Draft:</strong> {iteration.draft}
              </p>
              <p>{iteration.feedback}</p>
              {iteration.requiredChanges.length > 0 ? (
                <ul>
                  {iteration.requiredChanges.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type DraftComparisonPanelProps = Pick<
  ReflectionEvaluatorLoopController,
  "draft" | "verdict" | "rejectedIterations" | "acceptedIteration"
>;

export function DraftComparisonPanel({
  draft,
  verdict,
  rejectedIterations,
  acceptedIteration,
}: DraftComparisonPanelProps) {
  return (
    <div
      className="draft-comparison-panel"
      role="region"
      aria-label="Draft Comparison"
    >
      <div className="panel-title">
        <GitCompareArrows aria-hidden="true" size={18} />
        Draft Comparison
      </div>
      <div className="draft-comparison-grid">
        <section>
          <h3>Rejected Drafts</h3>
          {rejectedIterations.length === 0 ? (
            <p className="muted">
              Rejected drafts remain visible here after a retry.
            </p>
          ) : (
            rejectedIterations.map((iteration) => (
              <article
                key={iteration.iteration}
                className="draft-card rejected"
              >
                <strong>Attempt {iteration.iteration} rejected</strong>
                <p>{iteration.draft}</p>
                <code>{iteration.critique}</code>
              </article>
            ))
          )}
        </section>
        <section>
          <h3>Latest Accepted Draft</h3>
          {acceptedIteration ? (
            <article
              className={`draft-card ${acceptedIteration.verdict.toLowerCase() || "latest"}`}
            >
              <strong>
                Attempt {acceptedIteration.iteration}{" "}
                {acceptedIteration.verdict || "latest"}
              </strong>
              <p>{acceptedIteration.draft || draft}</p>
            </article>
          ) : (
            <p className="muted">{draft || "No draft yet."}</p>
          )}
        </section>
      </div>
    </div>
  );
}

type LoopEventsPanelProps = Pick<
  ReflectionEvaluatorLoopController,
  "loopEvents" | "verdict" | "score"
>;

export function LoopEventsPanel({
  loopEvents,
  verdict,
  score,
}: LoopEventsPanelProps) {
  return (
    <div className="loop-events-panel" role="region" aria-label="Loop Events">
      <div className="panel-title">Loop Events</div>
      <div className="loop-event-list">
        {loopEvents.length === 0 ? (
          <p className="muted">Custom progress events will appear here.</p>
        ) : (
          loopEvents.slice(0, 14).map((event, index) => (
            <div
              key={`${event.iteration}-${event.phase}-${index}`}
              className={`loop-event ${event.phase}`}
            >
              <Square aria-hidden="true" size={12} />
              <strong>{event.phase}</strong>
              <span>attempt {event.iteration}</span>
              {event.verdict ? (
                <span>
                  {event.verdict} {event.score ? `${event.score}/5` : ""}
                </span>
              ) : null}
              <p>{event.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type FinalAnswerPanelProps = Pick<
  ReflectionEvaluatorLoopController,
  "finalAnswer"
>;

export function FinalAnswerPanel({ finalAnswer }: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box">{finalAnswer || "No final answer yet."}</div>
    </div>
  );
}
