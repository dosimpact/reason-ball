import { percent } from "./model";

import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "editorEvents"
>;

export function CodeEditorEvents({
  editorEvents,
}: Props) {
  return (
    <div className="code-editor-events-panel" role="region" aria-label="Code Editor Events">
      <div className="panel-title">Code Editor Events</div>
      <div className="code-editor-event-list">
        {editorEvents.length === 0 ? (
          <p className="muted">No editor events yet.</p>
        ) : (
          editorEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="code-editor-event-row">
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
