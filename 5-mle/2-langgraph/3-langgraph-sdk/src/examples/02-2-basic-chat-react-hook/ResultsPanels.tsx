import type { useBasicChatReactHook } from "./useBasicChatReactHook";

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useBasicChatReactHook>, "events">) {
  return (
    <div className="event-panel">
      <div className="panel-title">Hook callback events</div>
      <div className="event-list compact">
        {events.length === 0 ? (
          <p className="muted">No callback events for this run yet.</p>
        ) : (
          events.map((entry) => (
            <details key={entry.id} className="event-row">
              <summary>
                <span>{entry.receivedAt}</span>
                <strong>{entry.event}</strong>
                {entry.runId ? <code>{entry.runId}</code> : null}
              </summary>
              <pre>{JSON.stringify(entry.data, null, 2)}</pre>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
