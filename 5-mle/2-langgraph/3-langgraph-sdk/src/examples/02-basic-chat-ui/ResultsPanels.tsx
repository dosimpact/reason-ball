import type { useBasicChat } from "./useBasicChat";

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useBasicChat>, "events">) {
  return (
    <div className="event-panel">
      <div className="panel-title">Thread stream events</div>
      <div className="event-list compact">
        {events.length === 0 ? (
          <p className="muted">No events for this run yet.</p>
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
