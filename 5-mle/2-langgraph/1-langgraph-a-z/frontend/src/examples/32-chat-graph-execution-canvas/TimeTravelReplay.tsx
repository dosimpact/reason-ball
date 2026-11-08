import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "selectedEvent"
  | "replaySummary"
  | "final"
  | "activeNodeDetail"
  | "selectedCheckpoint"
>;

export function TimeTravelReplay({
  selectedEvent,
  replaySummary,
  final,
  activeNodeDetail,
  selectedCheckpoint,
}: Props) {
  return (
    <div className="replay-summary-panel" role="region" aria-label="Time Travel Replay">
      <div className="panel-title">Time Travel Replay</div>
      <article className="replay-summary-card">
        <strong>{selectedEvent?.id || "No event selected"}</strong>
        <p>{replaySummary || final || "Select an event, then run a replay."}</p>
        <code>{selectedCheckpoint?.id || "no-checkpoint"}</code>
      </article>
      {activeNodeDetail ? (
        <article className="replay-summary-card">
          <strong>{activeNodeDetail.label}</strong>
          <p>{activeNodeDetail.detail}</p>
          <code>{activeNodeDetail.status}</code>
        </article>
      ) : null}
    </div>
  );
}
