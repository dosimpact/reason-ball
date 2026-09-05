import type { Todo } from "../apis/todos";
import { Button } from "../elements/Button";

interface TodoListProps {
  todos: Todo[];
  onToggle: (todo: Todo) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}

export function TodoList({ todos, onToggle, onRemove }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">◎</span>
        <p>No todos yet. Add one to create the first path in the graph.</p>
      </div>
    );
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <li className="todo-item" key={todo.id}>
          <label className="todo-item__content">
            <input
              checked={todo.completed}
              onChange={() => void onToggle(todo)}
              type="checkbox"
            />
            <span className={todo.completed ? "todo-item__title todo-item__title--done" : "todo-item__title"}>
              {todo.title}
            </span>
          </label>
          <Button
            aria-label={`Delete ${todo.title}`}
            onClick={() => void onRemove(todo.id)}
            type="button"
            variant="danger"
          >
            Delete
          </Button>
        </li>
      ))}
    </ul>
  );
}

