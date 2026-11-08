import { percent } from "./model";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "analysisEvents"
>;

export function AnalysisEvents({
  analysisEvents,
}: Props) {
  return (
    <div className="analysis-events-panel" role="region" aria-label="Analysis Events">
      <div className="panel-title">Analysis Events</div>
      <div className="analysis-event-list">
        {analysisEvents.length === 0 ? (
          <p className="muted">No analysis events yet.</p>
        ) : (
          analysisEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="analysis-event-row">
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
