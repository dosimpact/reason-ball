import { percent } from "./model";

import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "canvasEvents"
>;

export function CanvasEvents({
  canvasEvents,
}: Props) {
  return (
    <div className="graph-canvas-events-panel" role="region" aria-label="Canvas Events">
      <div className="panel-title">Canvas Events</div>
      <div className="graph-canvas-event-list">
        {canvasEvents.length === 0 ? (
          <p className="muted">No canvas events yet.</p>
        ) : (
          canvasEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="graph-canvas-event-row">
              <strong>{event.phase}</strong>
              <span>{event.status}</span>
              <p>{event.detail}</p>
              <code>{percent(event.progress)}%</code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
