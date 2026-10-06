import { ListTodo, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import { samplePrompts } from "./model";

import type { useTodoListMiddleware } from "./useTodoListMiddleware";

type Props = Pick<
  ReturnType<typeof useTodoListMiddleware>,
  | "prompt"
  | "setPrompt"
  | "threadId"
  | "status"
  | "todos"
  | "error"
  | "busy"
  | "resetView"
  | "runTodoList"
>;

export function RuntimeControls({
  prompt,
  setPrompt,
  threadId,
  status,
  todos,
  error,
  busy,
  resetView,
  runTodoList,
}: Props) {
  return (
    <aside className="todo-control">
      <div className="panel-title">
        <ListTodo aria-hidden="true" size={18} />
        Todo Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="sample-list" aria-label="Todo prompt samples">
        {samplePrompts.map((sample) => (
          <button
            key={sample}
            type="button"
            className="sample-button"
            onClick={() => setPrompt(sample)}
            disabled={busy}
          >
            {sample}
          </button>
        ))}
      </div>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void runTodoList(); }}>
        <label className="field">
          <span>Prompt</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run todo list
          </button>
          <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </form>
      <div className="runtime-facts">
        <div>
          <span>Status</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span>Thread</span>
          <strong>{threadId || "none"}</strong>
        </div>
        <div>
          <span>Todos</span>
          <strong>{todos.length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
