import { Calculator } from "lucide-react";

import type { useToolCallingReactHook } from "./useToolCallingReactHook";

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useToolCallingReactHook>, "events">) {
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
              </summary>
              <pre>{JSON.stringify(entry.data, null, 2)}</pre>
            </details>
          ))
        )}
      </div>
    </div>
  );
}

export function ToolCallsView({
  status,
  toolCards,
}: Pick<ReturnType<typeof useToolCallingReactHook>, "status" | "toolCards">) {
  return (
    <div className="tool-card-panel" role="region" aria-label="Tool Calls">
      <div className="panel-title">
        <Calculator aria-hidden="true" size={18} />
        Tool Calls
      </div>
      <div className="tool-card-list">
        {toolCards.length === 0 ? (
          <p className="muted">No tool calls yet.</p>
        ) : (
          toolCards.map((card) => (
            <article
              key={card.id}
              className={`tool-card ${card.status}`}
              aria-label={`Tool call ${card.name}`}
            >
              <div className="tool-card-header">
                <div>
                  <strong>{card.name}</strong>
                  <code>{card.id}</code>
                </div>
                <span className="tool-status">{card.status}</span>
              </div>
              <div className="tool-card-grid">
                <div>
                  <span>Arguments</span>
                  <pre>{JSON.stringify(card.args ?? {}, null, 2)}</pre>
                </div>
                <div>
                  <span>{card.status === "error" ? "Error" : "Result"}</span>
                  <pre>
                    {card.error ?? card.result ?? "Waiting for tool result"}
                  </pre>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
