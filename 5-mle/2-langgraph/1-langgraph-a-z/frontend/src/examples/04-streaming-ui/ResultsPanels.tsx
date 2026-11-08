import { Activity } from "lucide-react";

import type { useStreamingUi } from "./useStreamingUi";

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useStreamingUi>, "events">) {
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

export function ModePanelGridView({
  tokenText,
  updates,
  values,
  customEvents,
}: Pick<
  ReturnType<typeof useStreamingUi>,
  "tokenText" | "updates" | "values" | "customEvents"
>) {
  return (
    <div className="mode-panel-grid">
      <section className="stream-panel token-panel">
        <div className="panel-title">Token / Message Output</div>
        <div className="answer-box">
          {tokenText || "Run messages mode to see streamed text."}
        </div>
      </section>

      <section className="stream-panel">
        <div className="panel-title">State Updates</div>
        <div className="event-list compact">
          {updates.length === 0 ? (
            <p className="muted">No update payloads yet.</p>
          ) : (
            updates.map((update, index) => (
              <pre key={index} className="payload-box">
                {JSON.stringify(update, null, 2)}
              </pre>
            ))
          )}
        </div>
      </section>

      <section className="stream-panel">
        <div className="panel-title">Values Snapshots</div>
        <div className="event-list compact">
          {values.length === 0 ? (
            <p className="muted">No full-state snapshots yet.</p>
          ) : (
            values.map((value, index) => (
              <pre key={index} className="payload-box">
                {JSON.stringify(value, null, 2)}
              </pre>
            ))
          )}
        </div>
      </section>

      <section className="stream-panel">
        <div className="panel-title">
          <Activity aria-hidden="true" size={18} />
          Custom Progress Events
        </div>
        <div className="progress-list">
          {customEvents.length === 0 ? (
            <p className="muted">No custom progress events yet.</p>
          ) : (
            customEvents.map((item, index) => (
              <article key={index} className="progress-card">
                <div>
                  <strong>{item.node ?? "custom"}</strong>
                  <span>{item.phase ?? "event"}</span>
                </div>
                <meter min="0" max="1" value={item.progress ?? 0} />
                <p>{item.detail}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function StatePanelView({
  finalState,
}: Pick<ReturnType<typeof useStreamingUi>, "finalState">) {
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
