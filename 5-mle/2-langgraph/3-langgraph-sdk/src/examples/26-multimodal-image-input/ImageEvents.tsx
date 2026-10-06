import { percent } from "./model";

import type { useMultimodalImageInput } from "./useMultimodalImageInput";

type Props = Pick<
  ReturnType<typeof useMultimodalImageInput>,
  | "imageEvents"
>;

export function ImageEvents({
  imageEvents,
}: Props) {
  return (
    <div className="image-events-panel" role="region" aria-label="Image Events">
      <div className="panel-title">Image Events</div>
      <div className="image-event-list">
        {imageEvents.length === 0 ? (
          <p className="muted">Image stream events appear after the run.</p>
        ) : (
          imageEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="image-event-row">
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
