"use client";
import { useState } from "react";
import { useTodos } from "../hooks/use-todos";
import type { Todo } from "../shared/todo";
function TodoItem({
  todo,
  busy,
  save,
  remove,
}: {
  todo: Todo;
  busy: boolean;
  save: (patch: object) => Promise<boolean>;
  remove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  return (
    <li className={todo.completed ? "todo completed" : "todo"}>
      <input
        aria-label={todo.title + " 완료"}
        type="checkbox"
        checked={todo.completed}
        disabled={busy}
        onChange={() => void save({ completed: !todo.completed })}
      />
      {editing ? (
        <form
          className="edit"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await save({ title })) setEditing(false);
          }}
        >
          <input
            aria-label="수정할 제목"
            maxLength={200}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button disabled={busy}>저장</button>
          <button type="button" onClick={() => setEditing(false)}>
            취소
          </button>
        </form>
      ) : (
        <>
          <span className="title">{todo.title}</span>
          <button
            className="quiet"
            disabled={busy}
            onClick={() => {
              setTitle(todo.title);
              setEditing(true);
            }}
          >
            수정
          </button>
          <button className="quiet danger" disabled={busy} onClick={remove}>
            삭제
          </button>
        </>
      )}
    </li>
  );
}
export function TodoApp() {
  const { store, error, connection, busy, mutate, refresh } = useTodos();
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("전체");
  const todos = store.todos.filter(
    (t) =>
      filter === "전체" || (filter === "완료" ? t.completed : !t.completed),
  );
  return (
    <main>
      <header>
        <span className="eyebrow">LOCAL WORKSPACE · MCP</span>
        <h1>Todo Together</h1>
        <p>나와 AI가 함께 정리하는 작은 할 일 목록</p>
      </header>
      <section className="panel">
        <div className="status">
          <span role="status">{connection}</span>
          <span>revision {Math.max(0, store.revision)}</span>
        </div>
        <form
          className="create"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await mutate("", "POST", { title })) setTitle("");
          }}
        >
          <input
            aria-label="새 할 일"
            placeholder="무엇을 해야 하나요?"
            maxLength={200}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button disabled={busy || !title.trim()}>추가</button>
        </form>
        <nav aria-label="할 일 필터">
          {["전체", "미완료", "완료"].map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              className="filter"
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
          <span className="count">
            {store.todos.filter((t) => !t.completed).length}개 남음
          </span>
        </nav>
        {error && (
          <div role="alert">
            {error}
            <button onClick={() => void refresh()}>다시 시도</button>
          </div>
        )}
        {store.revision < 0 ? (
          <p className="empty">불러오는 중…</p>
        ) : todos.length === 0 ? (
          <p className="empty">
            할 일이 없습니다. 새로운 할 일을 추가해 보세요.
          </p>
        ) : (
          <ul>
            {todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                busy={busy}
                save={(patch) => mutate("/" + todo.id, "PATCH", patch)}
                remove={() => {
                  if (window.confirm("이 할 일을 삭제할까요?"))
                    void mutate("/" + todo.id, "DELETE");
                }}
              />
            ))}
          </ul>
        )}
      </section>
      <footer>
        <span>같은 목록, 두 개의 진입점.</span>
        <code>Codex ↔ /api/mcp</code>
      </footer>
    </main>
  );
}
