import { MessageSquare, Radio } from "lucide-react";
import type { useSdkConnection } from "./useSdkConnection";

export function ResultsPanel({
  answer,
}: Pick<ReturnType<typeof useSdkConnection>, "answer">) {
  return (
    <div className="result-panel">
      <div className="panel-title">
        <MessageSquare aria-hidden="true" size={18} /> OpenAI-backed response
      </div>
      <div className="answer-box">
        {answer || (
          <div className="answer-placeholder">
            <MessageSquare aria-hidden="true" size={28} />
            <strong>Your response will appear here</strong>
            <p>
              Choose an assistant and run your input to see the graph's
              response.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function StreamEventsPanel({
  runId,
  events,
}: Pick<ReturnType<typeof useSdkConnection>, "runId" | "events">) {
  return (
    <div className="event-panel">
      <div className="panel-title">
        <Radio aria-hidden="true" size={18} /> Stream events
      </div>
      <div className="event-list">
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
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
