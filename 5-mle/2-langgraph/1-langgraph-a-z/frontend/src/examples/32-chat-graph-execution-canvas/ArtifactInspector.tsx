import { MousePointer2, StepBack } from "lucide-react";

import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "executionEvents"
  | "selectedEventId"
  | "canInspect"
  | "chooseEvent"
  | "inspectSelectedEvent"
  | "runTimeTravel"
>;

export function ArtifactInspector({
  executionEvents,
  selectedEventId,
  canInspect,
  chooseEvent,
  inspectSelectedEvent,
  runTimeTravel,
}: Props) {
  return (
    <div className="graph-event-inspector-panel" role="region" aria-label="Event Inspector">
      <div className="panel-title">Event Inspector</div>
      <div className="graph-event-list">
        {executionEvents.length === 0 ? (
          <p className="muted">No execution events yet.</p>
        ) : (
          executionEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              className={event.id === selectedEventId ? "graph-event-row active" : "graph-event-row"}
              onClick={() => chooseEvent(event.id)}
            >
              <strong>{event.id}</strong>
              <span>{event.status}</span>
              <p>{event.detail}</p>
              <code>{event.nodeId}</code>
            </button>
          ))
        )}
      </div>
      <div className="button-row">
        <button type="button" className="primary-button" onClick={inspectSelectedEvent} disabled={!canInspect || !selectedEventId}>
          <MousePointer2 size={16} />
          Inspect selected event
        </button>
        <button type="button" className="secondary-button" onClick={runTimeTravel} disabled={!canInspect || !selectedEventId}>
          <StepBack size={16} />
          Time travel replay
        </button>
      </div>
    </div>
  );
}
