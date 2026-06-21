import { FormEvent, useMemo, useState } from 'react';
import './styles.css';

type Todo = {
  id: number;
  title: string;
  done: boolean;
};

const initialTodos: Todo[] = [
  { id: 1, title: 'Expose ./mount from the remote', done: true },
  { id: 2, title: 'Render through the BFF remote URL', done: false },
  { id: 3, title: 'Keep React bundled with the remote', done: false },
];

export function App() {
  const [todos, setTodos] = useState(initialTodos);
  const [draft, setDraft] = useState('');
  const remainingCount = useMemo(
    () => todos.filter((todo) => !todo.done).length,
    [todos],
  );

  function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draft.trim();
    if (!title) {
      return;
    }

    setTodos((currentTodos) => [
      ...currentTodos,
      { id: Date.now(), title, done: false },
    ]);
    setDraft('');
  }

  function toggleTodo(id: number) {
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    );
  }

  function clearDone() {
    setTodos((currentTodos) => currentTodos.filter((todo) => !todo.done));
  }

  return (
    <main className="todo-shell">
      <section className="todo-panel" aria-labelledby="todo-title">
        <div className="todo-heading">
          <div>
            <p className="todo-kicker">Todo remote</p>
            <h1 id="todo-title">Remote todo list</h1>
          </div>
          <span className="todo-count" aria-label={`${remainingCount} open tasks`}>
            {remainingCount} open
          </span>
        </div>

        <form className="todo-form" onSubmit={addTodo}>
          <input
            aria-label="New todo"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a task"
          />
          <button type="submit">Add</button>
        </form>

        <ul className="todo-list" aria-label="Todo items">
          {todos.map((todo) => (
            <li key={todo.id}>
              <label className={todo.done ? 'is-done' : undefined}>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span>{todo.title}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="todo-actions">
          <button type="button" onClick={clearDone}>
            Clear done
          </button>
          <span>Remote: todo | Port: 2803 | Expose: ./mount</span>
        </div>
      </section>
    </main>
  );
}
