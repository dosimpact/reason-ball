import { percent } from "./model";

import type { useChatPlanBoard } from "./useChatPlanBoard";

type Props = Pick<
  ReturnType<typeof useChatPlanBoard>,
  | "planEvents"
>;

export function PlanEvents({
  planEvents,
}: Props) {
  return (
    <div className="plan-board-events-panel" role="region" aria-label="Plan Events">
      <div className="panel-title">Plan Events</div>
      <div className="plan-board-event-list">
        {planEvents.length === 0 ? (
          <p className="muted">No plan events yet.</p>
        ) : (
          planEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="plan-board-event-row">
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
