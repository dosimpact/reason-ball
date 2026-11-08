import { AlertTriangle, ListTodo } from "lucide-react";

import { statusIcon } from "./presentation";

import type { useTodoListMiddleware } from "./useTodoListMiddleware";

type Props = Pick<
  ReturnType<typeof useTodoListMiddleware>,
  | "todos"
  | "middlewareErrors"
>;

export function TodoList({
  todos,
  middlewareErrors,
}: Props) {
  return (
    <div className="todo-board-panel" role="region" aria-label="Todo List">
      <div className="panel-title">
        <ListTodo aria-hidden="true" size={18} />
        Todo List
      </div>
      {middlewareErrors.length > 0 ? (
        <div className="todo-warning" role="alert">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{middlewareErrors[0].result}</span>
        </div>
      ) : null}
      <div className="todo-board-list">
        {todos.length === 0 ? (
          <p className="muted">No todo state yet.</p>
        ) : (
          todos.map((todo, index) => (
            <article key={todo.id} className={`todo-row ${todo.status}`}>
              <div className="todo-row-index">{index + 1}</div>
              <div className="todo-row-body">
                <strong>{todo.content}</strong>
                <div>
                  <span className="todo-status-chip">
                    {statusIcon(todo.status)}
                    {todo.status}
                  </span>
                  <code>{todo.source}</code>
                  <span>{todo.updatedAt}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
