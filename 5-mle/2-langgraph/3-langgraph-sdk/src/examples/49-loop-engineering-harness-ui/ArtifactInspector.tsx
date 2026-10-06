import { Sparkles } from "lucide-react";

import { formatJson } from "./model";

import type { useLoopEngineeringHarness } from "./useLoopEngineeringHarness";

type Props = Pick<
  ReturnType<typeof useLoopEngineeringHarness>,
  | "toolCalls"
  | "traceEvents"
  | "suggestions"
>;

export function ArtifactInspector({
  toolCalls,
  traceEvents,
  suggestions,
}: Props) {
  return (
    <aside className="artifact-inspector-panel">
      <div className="panel-title">
        <Sparkles aria-hidden="true" size={18} />
        Hill-Climbing Suggestions
      </div>
      {suggestions.length === 0 ? (
        <p className="muted">Suggestions appear after trace analysis.</p>
      ) : (
        suggestions.map((suggestion) => (
          <article key={suggestion.area} className="tool-card success">
            <div className="tool-card-header">
              <strong>{suggestion.area}</strong>
              <span className="tool-status">improve</span>
            </div>
            <p>{suggestion.suggestion}</p>
            <small>{suggestion.evidence}</small>
          </article>
        ))
      )}

      <div className="panel-title">Tool Calls</div>
      <div className="event-list compact">
        {toolCalls.length === 0 ? (
          <p className="muted">No tool calls yet.</p>
        ) : (
          toolCalls.map((call) => (
            <details key={call.id} className="event-row">
              <summary>
                <span>Attempt {call.attempt}</span>
                <strong>{call.name}</strong>
              </summary>
              <pre>{formatJson(call)}</pre>
            </details>
          ))
        )}
      </div>

      <div className="panel-title">Trace Events</div>
      <div className="event-list compact">
        {traceEvents.length === 0 ? (
          <p className="muted">No trace events yet.</p>
        ) : (
          traceEvents.map((event, index) => (
            <article key={`${event.loop}-${event.phase}-${index}`} className="event-row">
              <summary>
                <span>{event.loop}</span>
                <strong>{event.phase}</strong>
              </summary>
              <p>{event.detail}</p>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
