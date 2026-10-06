import { type StreamLogEntry } from "../../lib/langgraphClient";
import { type JsonRecord } from "./stream";

export function RunDiagnostics({ events, finalState }: { events: StreamLogEntry[]; finalState: JsonRecord | null }) {
  return (
    <details className="event-panel push-ui-chat-debug">
      <summary>실행 상태와 스트림 상세</summary>
      <div role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? JSON.stringify(finalState, null, 2) : "No final state yet."}</pre>
      </div>
      <div role="region" aria-label="Raw Stream Events">
        <div className="panel-title">Raw Stream Events</div>
        {events.map((entry) => (
          <details key={entry.id} className="event-row">
            <summary>{entry.event}</summary>
            <pre>{JSON.stringify(entry.data, null, 2)}</pre>
          </details>
        ))}
      </div>
    </details>
  );
}
