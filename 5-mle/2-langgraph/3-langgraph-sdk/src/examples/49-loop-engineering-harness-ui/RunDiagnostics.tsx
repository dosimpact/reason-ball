import { formatJson } from "./model";
import type { useLoopEngineeringHarness } from "./useLoopEngineeringHarness";

type Props = Pick<
  ReturnType<typeof useLoopEngineeringHarness>,
  | "finalState"
  | "events"
>;

export function RunDiagnostics({
  finalState,
  events,
}: Props) {
  return <>
    <div className="state-panel">
      <div className="panel-title">Final State</div>
      <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
    </div>
    <div className="event-panel">
      <div className="panel-title">Raw Stream Events</div>
      <div className="event-list compact">
        {events.length === 0 ? (
          <p className="muted">No stream events yet.</p>
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
