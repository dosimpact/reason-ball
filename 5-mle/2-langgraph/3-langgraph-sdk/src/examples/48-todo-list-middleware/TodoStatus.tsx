
import type { useTodoListMiddleware } from "./useTodoListMiddleware";

type Props = Pick<
  ReturnType<typeof useTodoListMiddleware>,
  | "counts"
>;

export function TodoStatus({
  counts,
}: Props) {
  return (
    <div className="todo-status-panel" role="region" aria-label="Todo Status">
      <div className="panel-title">Todo Status</div>
      <div className="todo-status-grid">
        <div>
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </div>
        <div>
          <span>In Progress</span>
          <strong>{counts.inProgress}</strong>
        </div>
        <div>
          <span>Completed</span>
          <strong>{counts.completed}</strong>
        </div>
      </div>
    </div>
  );
}
