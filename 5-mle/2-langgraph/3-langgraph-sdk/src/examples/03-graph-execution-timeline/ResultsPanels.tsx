import { CheckCircle2, Clock3 } from "lucide-react";

import type { useGraphExecutionTimeline } from "./useGraphExecutionTimeline";

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useGraphExecutionTimeline>, "events">) {
  return (
    <div className="event-panel">
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

export function TimelinePanelView({
  status,
  nodes,
}: Pick<ReturnType<typeof useGraphExecutionTimeline>, "status" | "nodes">) {
  return (
    <div className="timeline-panel">
      <div className="panel-title">Node Timeline</div>
      <div className="timeline-node-list">
        {nodes.map((node) => (
          <article key={node.name} className={`timeline-node ${node.status}`}>
            <div className="timeline-node-header">
              {node.status === "done" ? (
                <CheckCircle2 size={18} />
              ) : (
                <Clock3 size={18} />
              )}
              <div>
                <strong>{node.label}</strong>
                <code>{node.name}</code>
              </div>
              <span>{node.status}</span>
            </div>
            <pre>
              {node.update
                ? JSON.stringify(node.update, null, 2)
                : "Waiting for update"}
            </pre>
          </article>
        ))}
      </div>
    </div>
  );
}

export function StatePanelView({
  finalState,
}: Pick<ReturnType<typeof useGraphExecutionTimeline>, "finalState">) {
  return (
    <div className="state-panel">
      <div className="panel-title">Final State</div>
      <pre>
        {finalState
          ? JSON.stringify(finalState, null, 2)
          : "No final state yet."}
      </pre>
    </div>
  );
}
