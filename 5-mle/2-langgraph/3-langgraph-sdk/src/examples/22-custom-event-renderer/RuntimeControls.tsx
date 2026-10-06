import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  RadioTower,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { warningPrompt, cleanPrompt } from "./data";
import { type CustomEventRendererController } from "./useCustomEventRenderer";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  CustomEventRendererController,
  | "taskId"
  | "setTaskId"
  | "taskPrompt"
  | "setTaskPrompt"
  | "threadId"
  | "runId"
  | "status"
  | "error"
  | "busy"
  | "resetView"
  | "runRenderer"
>;

export function RuntimeControls({
  taskId,
  setTaskId,
  taskPrompt,
  setTaskPrompt,
  threadId,
  runId,
  status,
  error,
  busy,
  resetView,
  runRenderer,
}: RuntimeControlsProps) {
  return (
    <aside className="custom-event-control">
      <div className="panel-title">
        <RadioTower aria-hidden="true" size={18} />
        Custom Event Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setTaskPrompt(warningPrompt)}
          disabled={busy}
        >
          <AlertTriangle size={16} />
          Use warning sample
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setTaskPrompt(cleanPrompt)}
          disabled={busy}
        >
          <CheckCircle2 size={16} />
          Use clean sample
        </button>
      </div>
      <form
        className="run-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runRenderer();
        }}
      >
        <label className="field">
          <span>Task ID</span>
          <input
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Task prompt</span>
          <textarea
            value={taskPrompt}
            onChange={(event) => setTaskPrompt(event.target.value)}
            rows={5}
          />
        </label>
        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !taskId.trim() || !taskPrompt.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run renderer
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={resetView}
            disabled={busy}
          >
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
          <span>Run ID</span>
          <strong>{runId || "none"}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
