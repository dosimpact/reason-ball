import { GitFork } from "lucide-react";

import type { useConditionalRouting } from "./useConditionalRouting";

export function ResultsPanel({
  branchResult,
}: Pick<ReturnType<typeof useConditionalRouting>, "branchResult">) {
  return (
    <div
      className="result-panel routing-result"
      role="region"
      aria-label="Branch Result"
    >
      <div className="panel-title">Branch Result</div>
      <div className="answer-box">
        {branchResult || "No branch result yet."}
      </div>
    </div>
  );
}

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useConditionalRouting>, "events">) {
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

export function RouteDecisionView({
  selectedBranch,
  routeReason,
  skippedBranches,
}: Pick<
  ReturnType<typeof useConditionalRouting>,
  "selectedBranch" | "routeReason" | "skippedBranches"
>) {
  return (
    <div
      className="routing-decision-panel"
      role="region"
      aria-label="Route Decision"
    >
      <div className="panel-title">
        <GitFork aria-hidden="true" size={18} />
        Route Decision
      </div>
      {selectedBranch ? (
        <div className="route-decision-card">
          <span>Selected branch</span>
          <strong>{selectedBranch}</strong>
          <span>Routing reason</span>
          <p>{routeReason}</p>
          <span>Skipped branches</span>
          <p>{skippedBranches.length ? skippedBranches.join(", ") : "none"}</p>
        </div>
      ) : (
        <p className="muted">
          Run a request to see the conditional edge decision.
        </p>
      )}
    </div>
  );
}

export function BranchMapView({
  status,
  branches,
}: Pick<ReturnType<typeof useConditionalRouting>, "status" | "branches">) {
  return (
    <div className="branch-map-panel" role="region" aria-label="Branch Map">
      <div className="panel-title">Branch Map</div>
      <div className="branch-card-grid">
        {branches.map((branch) => (
          <article key={branch.name} className={`branch-card ${branch.status}`}>
            <div className="branch-card-header">
              <strong>{branch.label}</strong>
              <span>
                {branch.status === "done" ? "selected done" : branch.status}
              </span>
            </div>
            <code>{branch.name}</code>
            <p>{branch.reason}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function FinalStateView({
  finalState,
}: Pick<ReturnType<typeof useConditionalRouting>, "finalState">) {
  return (
    <div
      className="state-panel routing-state"
      role="region"
      aria-label="Final State"
    >
      <div className="panel-title">Final State</div>
      <pre>
        {finalState
          ? JSON.stringify(finalState, null, 2)
          : "No final state yet."}
      </pre>
    </div>
  );
}
