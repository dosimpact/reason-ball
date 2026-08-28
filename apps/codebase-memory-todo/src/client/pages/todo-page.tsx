import { TodoForm } from "../components/todo-form";
import { TodoList } from "../components/todo-list";
import { useTodoWorkflow } from "../hooks/use-todo-workflow";

export function TodoPage() {
  const workflow = useTodoWorkflow();

  return (
    <main className="app-shell">
      <section className="todo-card">
        <header>
          <p className="eyebrow">Static relationship analysis lab</p>
          <h1>Codebase Memory Todo</h1>
          <p className="description">
            Follow one todo through view, hook, fetch, route, service, and repository.
          </p>
        </header>

        <TodoForm onAdd={workflow.addTodo} submitting={workflow.submitting} />

        <div className="summary" aria-label="Todo summary">
          <span>{workflow.summary.total} total</span>
          <span>{workflow.summary.remaining} remaining</span>
          <span>{workflow.summary.completed} complete</span>
        </div>

        {workflow.error ? (
          <div className="error-banner" role="alert">
            <span>{workflow.error}</span>
            <button onClick={() => void workflow.reloadTodos()} type="button">Retry</button>
          </div>
        ) : null}

        {workflow.loading ? (
          <p className="loading-state">Loading relationship nodes…</p>
        ) : (
          <TodoList
            onRemove={workflow.removeTodo}
            onToggle={workflow.changeCompletion}
            todos={workflow.todos}
          />
        )}
      </section>
    </main>
  );
}
