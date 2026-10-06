import { ChevronRight, GitBranch } from "lucide-react";

import { formatJson } from "./data";
import type { useSubgraphNestedExecution } from "./useSubgraphNestedExecution";

export function ResultsPanel({
  final,
}: Pick<ReturnType<typeof useSubgraphNestedExecution>, "final">) {
  return (
    <div
      className="result-panel nested-result"
      role="region"
      aria-label="Nested Result"
    >
      <div className="panel-title">Nested Result</div>
      <div className="answer-box">{final || "No nested result yet."}</div>
    </div>
  );
}

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useSubgraphNestedExecution>, "events">) {
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
              <pre>{formatJson(entry.data)}</pre>
            </details>
          ))
        )}
      </div>
    </div>
  );
}

export function BreadcrumbView({
  breadcrumb,
}: Pick<ReturnType<typeof useSubgraphNestedExecution>, "breadcrumb">) {
  return (
    <div className="breadcrumb-panel" role="region" aria-label="Breadcrumb">
      <div className="panel-title">
        <GitBranch aria-hidden="true" size={18} />
        Breadcrumb
      </div>
      <div className="breadcrumb-list">
        {(breadcrumb.length
          ? breadcrumb
          : ["parent", "subgraph", "worker"]
        ).map((item, index) => (
          <span key={`${item}-${index}`} className="breadcrumb-chip">
            {index > 0 ? <ChevronRight aria-hidden="true" size={14} /> : null}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function NestedExecutionTreeView({
  selectedTeam,
  parentSteps,
  subgraphSteps,
}: Pick<
  ReturnType<typeof useSubgraphNestedExecution>,
  "selectedTeam" | "parentSteps" | "subgraphSteps"
>) {
  return (
    <div
      className="nested-tree-panel"
      role="region"
      aria-label="Nested Execution Tree"
    >
      <div className="panel-title">Nested Execution Tree</div>
      <div className="nested-tree">
        {parentSteps.length === 0 ? (
          <p className="muted">
            Run a request to see parent and subgraph execution.
          </p>
        ) : (
          <>
            <div className="tree-node parent">
              <strong>Parent supervisor</strong>
              <span>parent</span>
            </div>
            {parentSteps.map((step) => (
              <article key={step.id} className="tree-node parent">
                <strong>{step.label}</strong>
                <code>{step.path.join(" > ")}</code>
                <p>{step.summary}</p>
              </article>
            ))}
            <details className="nested-tree-group" open>
              <summary>
                <strong>{selectedTeam || "subgraph team"}</strong>
                <span>{subgraphSteps.length} worker steps</span>
              </summary>
              <div className="tree-children">
                {subgraphSteps.map((step) => (
                  <article key={step.id} className={`tree-node ${step.level}`}>
                    <strong>{step.label}</strong>
                    <code>{step.path.join(" > ")}</code>
                    <p>{step.summary}</p>
                  </article>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

export function ParentStateView({
  parentMessages,
  parentState,
}: Pick<
  ReturnType<typeof useSubgraphNestedExecution>,
  "parentMessages" | "parentState"
>) {
  return (
    <div className="nested-state-panel" role="region" aria-label="Parent State">
      <div className="panel-title">Parent State</div>
      <pre>
        {parentState
          ? formatJson({
              parent_state: parentState,
              parent_messages: parentMessages,
            })
          : "No parent state yet."}
      </pre>
    </div>
  );
}

export function SubgraphStateView({
  subgraphMessages,
  subgraphState,
}: Pick<
  ReturnType<typeof useSubgraphNestedExecution>,
  "subgraphMessages" | "subgraphState"
>) {
  return (
    <div
      className="subgraph-state-panel"
      role="region"
      aria-label="Subgraph State"
    >
      <div className="panel-title">Subgraph State</div>
      <details open>
        <summary>Subgraph details: team and worker state</summary>
        <pre>
          {subgraphState
            ? formatJson({
                subgraph_state: subgraphState,
                subgraph_messages: subgraphMessages,
              })
            : "No subgraph state yet."}
        </pre>
      </details>
    </div>
  );
}

export function FinalStateView({
  finalState,
}: Pick<ReturnType<typeof useSubgraphNestedExecution>, "finalState">) {
  return (
    <div
      className="state-panel nested-final-state"
      role="region"
      aria-label="Final State"
    >
      <div className="panel-title">Final State</div>
      <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
    </div>
  );
}
