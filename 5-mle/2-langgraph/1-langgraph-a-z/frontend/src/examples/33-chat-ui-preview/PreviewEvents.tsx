import { percent } from "./model";

import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "previewEvents"
>;

export function PreviewEvents({
  previewEvents,
}: Props) {
  return (
    <div className="ui-preview-events-panel" role="region" aria-label="Preview Events">
      <div className="panel-title">Preview Events</div>
      <div className="ui-preview-event-list">
        {previewEvents.length === 0 ? (
          <p className="muted">No preview events yet.</p>
        ) : (
          previewEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="ui-preview-event-row">
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
