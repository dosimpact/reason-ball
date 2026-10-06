import { formatJson } from "./model";
import type { useTodoListMiddleware } from "./useTodoListMiddleware";

type Props = Pick<
  ReturnType<typeof useTodoListMiddleware>,
  | "finalState"
  | "events"
>;

export function RunDiagnostics({
  finalState,
  events,
}: Props) {
  return <>
    <div className="state-panel todo-final-state" role="region" aria-label="Final State">
      <div className="panel-title">Final State</div>
      <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
    </div>
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
                <strong>event {entry.event}</strong>
              </summary>
              <pre>{formatJson(entry.data)}</pre>
            </details>
          ))
        )}
      </div>
    </div>
  </>;
}
