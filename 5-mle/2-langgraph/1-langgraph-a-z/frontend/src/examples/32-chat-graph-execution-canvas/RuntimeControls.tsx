import { GitBranch, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "userPrompt"
  | "setUserPrompt"
  | "threadId"
  | "status"
  | "artifactVersion"
  | "error"
  | "busy"
  | "resetView"
  | "runInspect"
>;

export function RuntimeControls({
  userPrompt,
  setUserPrompt,
  threadId,
  status,
  artifactVersion,
  error,
  busy,
  resetView,
  runInspect,
}: Props) {
  return (
    <aside className="graph-canvas-control">
      <div className="panel-title">
        <GitBranch aria-hidden="true" size={18} />
        Graph Canvas Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void runInspect(); }}>
        <label className="field">
          <span>Debugger prompt</span>
          <textarea value={userPrompt} onChange={(event) => setUserPrompt(event.target.value)} rows={5} />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !userPrompt.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run graph canvas
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
          <span>Thread ID</span>
          <strong>{threadId || "none"}</strong>
        </div>
        <div>
          <span>Version</span>
          <strong>v{artifactVersion}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
