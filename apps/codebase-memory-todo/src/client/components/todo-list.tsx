import type { TodoDto } from "../api/todos-api";

interface TodoListProps {
  todos: TodoDto[];
  onToggle: (todo: TodoDto) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}

export function TodoList({ todos, onToggle, onRemove }: TodoListProps) {
  if (todos.length === 0) {
    return <p className="empty-state">No paths yet. Add a todo to create one.</p>;
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <li key={todo.id}>
          <label>
            <input
              checked={todo.completed}
              onChange={() => void onToggle(todo)}
              type="checkbox"
            />
            <span className={todo.completed ? "completed" : ""}>{todo.title}</span>
          </label>
          <button
            aria-label={`Delete ${todo.title}`}
            className="delete-button"
            onClick={() => void onRemove(todo.id)}
            type="button"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
