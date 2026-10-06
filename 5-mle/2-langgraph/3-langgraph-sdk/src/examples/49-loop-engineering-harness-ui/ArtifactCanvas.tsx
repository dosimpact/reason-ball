import { CheckCircle2, TimerReset, XCircle } from "lucide-react";

import { loopCards } from "./presentation";

import type { useLoopEngineeringHarness } from "./useLoopEngineeringHarness";

type Props = Pick<
  ReturnType<typeof useLoopEngineeringHarness>,
  | "activeLoop"
  | "attempts"
  | "verifications"
  | "traceEvents"
  | "finalAnswer"
  | "stopReason"
  | "latestVerification"
>;

export function ArtifactCanvas({
  activeLoop,
  attempts,
  verifications,
  traceEvents,
  finalAnswer,
  stopReason,
  latestVerification,
}: Props) {
  return (
    <div className="artifact-canvas-panel">
      <div className="panel-title">Loop Stack</div>
      <div className="metric-grid">
        {loopCards.map((loop) => {
          const Icon = loop.icon;
          const isActive = activeLoop === loop.id;
          const hasTrace = traceEvents.some((event) => event.loop === loop.id);
          return (
            <article key={loop.id} className={isActive ? "metric-card active" : "metric-card"}>
              <Icon aria-hidden="true" size={18} />
              <span>{loop.title}</span>
              <strong>{hasTrace ? "seen" : "waiting"}</strong>
              <p>{loop.detail}</p>
            </article>
          );
        })}
      </div>

      <div className="artifact-section">
        <div className="panel-title">
          <TimerReset aria-hidden="true" size={18} />
          Attempt Timeline
        </div>
        {attempts.length === 0 ? (
          <p className="muted">Run the graph to see retry attempts.</p>
        ) : (
          attempts.map((attempt) => {
            const verification = verifications.find((item) => item.attempt === attempt.attempt);
            return (
              <article key={attempt.attempt} className="event-row">
                <summary>
                  <span>Attempt {attempt.attempt}</span>
                  <strong>{verification?.verdict ?? attempt.status}</strong>
                </summary>
                <p>{attempt.draft}</p>
                {verification ? (
                  <div className="runtime-facts">
                    <div>
                      <span>Score</span>
                      <strong>{verification.score}/{verification.threshold}</strong>
                    </div>
                    <div>
                      <span>Verdict</span>
                      <strong>{verification.verdict}</strong>
                    </div>
                    <div>
                      <span>Retry</span>
                      <strong>{verification.retryReason || "none"}</strong>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      <div className="artifact-section">
        <div className="panel-title">
          {latestVerification?.verdict === "PASS" ? (
            <CheckCircle2 aria-hidden="true" size={18} />
          ) : (
            <XCircle aria-hidden="true" size={18} />
          )}
          Final Output
        </div>
        <p>{finalAnswer || "No final answer yet."}</p>
        <code>{stopReason || "no stop reason"}</code>
      </div>
    </div>
  );
}
