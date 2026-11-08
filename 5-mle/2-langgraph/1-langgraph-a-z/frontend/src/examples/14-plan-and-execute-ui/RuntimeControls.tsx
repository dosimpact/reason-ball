import { Loader2, Play, RotateCcw, Route } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples, modes } from "./data";
import { type PlanAndExecuteController } from "./usePlanAndExecute";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  PlanAndExecuteController,
  | "task"
  | "setTask"
  | "controlMode"
  | "setControlMode"
  | "threadId"
  | "status"
  | "planSteps"
  | "error"
  | "busy"
  | "resetView"
  | "runPlan"
>;

export function RuntimeControls({
  task,
  setTask,
  controlMode,
  setControlMode,
  threadId,
  status,
  planSteps,
  error,
  busy,
  resetView,
  runPlan,
}: RuntimeControlsProps) {
  return (
    <aside className="plan-execute-control">
      <div className="panel-title">
        <Route aria-hidden="true" size={18} />
        Plan Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="sample-list" aria-label="Plan task samples">
        {samples.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="sample-button"
            onClick={() => setTask(sample.value)}
            disabled={busy}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <div className="mode-picker" role="radiogroup" aria-label="Run mode">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={controlMode === mode.value}
            className={
              controlMode === mode.value ? "mode-option active" : "mode-option"
            }
            onClick={() => setControlMode(mode.value)}
            disabled={busy}
          >
            <strong>{mode.label}</strong>
            <span>{mode.detail}</span>
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runPlan();
        }}
        className="run-form"
      >
        <label className="field">
          <span>Task</span>
          <textarea
            value={task}
            onChange={(event) => setTask(event.target.value)}
            rows={6}
          />
        </label>
        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !task.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run plan
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
          <span>Steps</span>
          <strong>{planSteps.length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
