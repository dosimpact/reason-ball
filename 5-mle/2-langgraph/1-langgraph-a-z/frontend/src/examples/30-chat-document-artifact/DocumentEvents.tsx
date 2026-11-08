import { percent } from "./model";

import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "documentEvents"
>;

export function DocumentEvents({
  documentEvents,
}: Props) {
  return (
    <div className="document-events-panel" role="region" aria-label="Document Events">
      <div className="panel-title">Document Events</div>
      <div className="document-event-list">
        {documentEvents.length === 0 ? (
          <p className="muted">No document events yet.</p>
        ) : (
          documentEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="document-event-row">
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
