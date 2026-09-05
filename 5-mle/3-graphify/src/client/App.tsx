import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Todo, todoApi } from "./api";

type Filter = "all" | "active" | "completed";

const filterLabels: Record<Filter, string> = {
  all: "전체",
  active: "진행 중",
  completed: "완료",
};

export function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTodos(await todoApi.list());
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  const visibleTodos = useMemo(
    () =>
      todos.filter((todo) => {
        if (filter === "active") return !todo.completed;
        if (filter === "completed") return todo.completed;
        return true;
      }),
    [filter, todos],
  );

  const remaining = todos.filter((todo) => !todo.completed).length;

  async function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle || creating) return;

    setCreating(true);
    setError(null);
    try {
      const created = await todoApi.create(normalizedTitle);
      setTodos((current) => [...current, created]);
      setTitle("");
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setCreating(false);
    }
  }

  async function updateTodo(todo: Todo, input: { title?: string; completed?: boolean }) {
    setPendingIds((current) => new Set(current).add(todo.id));
    setError(null);
    try {
      const updated = await todoApi.update(todo.id, input);
      setTodos((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(todo.id);
        return next;
      });
    }
  }

  async function removeTodo(todo: Todo) {
    setPendingIds((current) => new Set(current).add(todo.id));
    setError(null);
    try {
      await todoApi.remove(todo.id);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
    } catch (caught) {
      setError(toMessage(caught));
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(todo.id);
        return next;
      });
    }
  }

  return (
    <main className="page-shell">
      <section className="todo-card" aria-labelledby="page-title">
        <header className="hero">
          <span className="eyebrow">GRAPHIFY PRACTICE</span>
          <h1 id="page-title">작은 일을 선명하게.</h1>
          <p>오늘 해야 할 일을 기록하고, 하나씩 가볍게 완료하세요.</p>
        </header>

        <form className="add-form" onSubmit={addTodo}>
          <label htmlFor="new-todo">새 할 일</label>
          <div className="add-row">
            <input
              id="new-todo"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: Graphify 구조 살펴보기"
              maxLength={120}
              disabled={creating}
              autoComplete="off"
            />
            <button type="submit" disabled={!title.trim() || creating}>
              {creating ? "추가 중…" : "추가"}
            </button>
          </div>
        </form>

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="오류 닫기">
              ×
            </button>
          </div>
        )}

        <div className="toolbar">
          <p aria-live="polite">
            <strong>{remaining}</strong>개 남음
          </p>
          <div className="filters" aria-label="할 일 필터">
            {(Object.keys(filterLabels) as Filter[]).map((value) => (
              <button
                type="button"
                key={value}
                className={filter === value ? "active" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {filterLabels[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="list-region" aria-busy={loading}>
          {loading ? (
            <div className="status-state" role="status">
              <span className="spinner" aria-hidden="true" />
              할 일을 불러오는 중입니다…
            </div>
          ) : visibleTodos.length === 0 ? (
            <div className="status-state empty-state">
              <span aria-hidden="true">✓</span>
              <h2>{todos.length === 0 ? "아직 할 일이 없어요" : "조건에 맞는 할 일이 없어요"}</h2>
              <p>{todos.length === 0 ? "첫 번째 할 일을 위에서 추가해 보세요." : "다른 필터를 선택해 보세요."}</p>
            </div>
          ) : (
            <ul className="todo-list">
              {visibleTodos.map((todo) => {
                const pending = pendingIds.has(todo.id);
                return (
                  <li key={todo.id} className={todo.completed ? "completed" : ""}>
                    <label className="todo-check">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        disabled={pending}
                        onChange={() => void updateTodo(todo, { completed: !todo.completed })}
                      />
                      <span aria-hidden="true" />
                      <span className="sr-only">
                        {todo.completed ? "완료 취소:" : "완료:"} {todo.title}
                      </span>
                    </label>
                    <TodoTitle todo={todo} disabled={pending} onSave={updateTodo} />
                    <button
                      className="delete-button"
                      type="button"
                      disabled={pending}
                      onClick={() => void removeTodo(todo)}
                      aria-label={`${todo.title} 삭제`}
                    >
                      {pending ? "…" : "삭제"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function TodoTitle({
  todo,
  disabled,
  onSave,
}: {
  todo: Todo;
  disabled: boolean;
  onSave: (todo: Todo, input: { title: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = draft.trim();
    if (!normalized) return;
    void onSave(todo, { title: normalized }).then(() => setEditing(false));
  }

  if (editing) {
    return (
      <form className="edit-form" onSubmit={submit}>
        <label className="sr-only" htmlFor={`todo-title-${todo.id}`}>할 일 제목 수정</label>
        <input
          id={`todo-title-${todo.id}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={120}
          disabled={disabled}
          autoFocus
        />
        <button type="submit" disabled={!draft.trim() || disabled}>저장</button>
        <button type="button" onClick={() => { setDraft(todo.title); setEditing(false); }}>취소</button>
      </form>
    );
  }

  return (
    <button className="todo-title" type="button" disabled={disabled} onClick={() => setEditing(true)}>
      {todo.title}
      <span className="sr-only"> 수정</span>
    </button>
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}
