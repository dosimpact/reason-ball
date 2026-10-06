import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "checkpoints"
  | "selectedCheckpoint"
>;

export function CheckpointTimeline({
  checkpoints,
  selectedCheckpoint,
}: Props) {
  return (
    <div className="checkpoint-canvas-panel" role="region" aria-label="Checkpoint Timeline">
      <div className="panel-title">Checkpoint Timeline</div>
      <div className="checkpoint-canvas-list">
        {checkpoints.length === 0 ? (
          <p className="muted">No checkpoints yet.</p>
        ) : (
          checkpoints.map((checkpoint) => (
            <article key={checkpoint.id} className={checkpoint.id === selectedCheckpoint?.id ? "checkpoint-canvas-row active" : "checkpoint-canvas-row"}>
              <strong>{checkpoint.label}</strong>
              <code>{checkpoint.id}</code>
              <p>{checkpoint.summary}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
