import { Activity } from "lucide-react";

import type { useStreamingReactHook } from "./useStreamingReactHook";

export function StreamEventsPanel({
  runId,
  events,
}: Pick<ReturnType<typeof useStreamingReactHook>, "runId" | "events">) {
  return (
    <div className="event-panel">
      <div className="panel-title">Hook Callback Events</div>
      <div className="event-list compact">
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

export function ModePanelGridView({
  updates,
  values,
  customEvents,
  tokenText,
}: Pick<
  ReturnType<typeof useStreamingReactHook>,
  "updates" | "values" | "customEvents" | "tokenText"
>) {
  return (
    <div className="mode-panel-grid">
      <section className="stream-panel token-panel">
        <div className="panel-title">Token / Message Output</div>
        <div className="answer-box">
          {tokenText || "Run messages mode to see hook-managed text."}
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
            <p className="muted">No hook values snapshots yet.</p>
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
  values,
  stream,
}: Pick<ReturnType<typeof useStreamingReactHook>, "values" | "stream">) {
  return (
    <div className="state-panel">
      <div className="panel-title">Hook Values</div>
      <pre>{JSON.stringify(stream.values, null, 2)}</pre>
    </div>
  );
}
