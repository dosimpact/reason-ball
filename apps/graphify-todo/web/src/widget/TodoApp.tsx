import { Button } from "../elements/Button";
import { useTodos } from "../hooks/useTodos";
import { getTodoSummary } from "../utils/todo-summary";
import { TodoForm } from "./TodoForm";
import { TodoList } from "./TodoList";

export function TodoApp() {
  const { todos, loading, submitting, error, addTodo, toggleTodo, removeTodo, reload } = useTodos();
  const summary = getTodoSummary(todos);

  return (
    <main className="app-shell">
      <section className="todo-card">
        <header className="hero">
          <div>
            <p className="eyebrow">NestJS + React knowledge graph lab</p>
            <h1>Graphify Todo</h1>
            <p className="hero__copy">
              Change a node, refresh the graph, and inspect how the dependency paths evolve.
            </p>
          </div>
          <div className="graph-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </header>

        <TodoForm onSubmit={addTodo} submitting={submitting} />

        <div className="summary" aria-label="Todo summary">
          <span>{summary.total} total</span>
          <span>{summary.remaining} remaining</span>
          <span>{summary.completed} complete</span>
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <Button onClick={() => void reload()} type="button" variant="quiet">
              Retry
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p className="loading-state">Loading graph nodes…</p>
        ) : (
          <TodoList onRemove={removeTodo} onToggle={toggleTodo} todos={todos} />
        )}
      </section>
    </main>
  );
}

