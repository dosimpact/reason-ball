
import type { useChatPlanBoard } from "./useChatPlanBoard";

type Props = Pick<
  ReturnType<typeof useChatPlanBoard>,
  | "executionLog"
>;

export function ExecutionLog({
  executionLog,
}: Props) {
  return (
    <div className="plan-execution-log-panel" role="region" aria-label="Execution Log">
      <div className="panel-title">Execution Log</div>
      <div className="plan-execution-log-list">
        {executionLog.length === 0 ? (
          <p className="muted">No execution log yet.</p>
        ) : (
          executionLog.map((entry, index) => (
            <article key={`${entry.stepId}-${index}`} className={`plan-log-row ${entry.status}`}>
              <strong>{entry.stepId}</strong>
              <span>{entry.status}</span>
              <p>{entry.detail}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
