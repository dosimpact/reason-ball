import type { useSdkConnectionReactHook } from "./useSdkConnectionReactHook";

export function ResultsPanel({
  answer,
}: Pick<ReturnType<typeof useSdkConnectionReactHook>, "answer">) {
  return (
    <div className="result-panel">
      <div className="panel-title">Hook-managed response</div>
      <div className="answer-box">{answer}</div>
    </div>
  );
}

export function StreamEventsPanel({
  runId,
  events,
}: Pick<ReturnType<typeof useSdkConnectionReactHook>, "runId" | "events">) {
  return (
    <div className="event-panel">
      <div className="panel-title">Hook callback events</div>
      <div className="event-list">
        {events.length === 0 ? (
          <p className="muted">No callback events yet.</p>
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

export function StatePanelView({
  stream,
}: Pick<ReturnType<typeof useSdkConnectionReactHook>, "stream">) {
  return (
    <div className="state-panel">
      <div className="panel-title">Stream Values</div>
      <pre>{JSON.stringify(stream.values, null, 2)}</pre>
    </div>
  );
}
