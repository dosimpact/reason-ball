import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "stateDiff"
>;

export function StateDiff({
  stateDiff,
}: Props) {
  return (
    <div className="state-diff-panel" role="region" aria-label="State Diff">
      <div className="panel-title">State Diff</div>
      <div className="state-diff-list">
        {stateDiff.length === 0 ? (
          <p className="muted">No state diff yet.</p>
        ) : (
          stateDiff.map((row) => (
            <article key={row.key} className={`state-diff-row ${row.status}`}>
              <strong>{row.key}</strong>
              <span>{row.status}</span>
              <p>{row.before}</p>
              <p>{row.after}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
