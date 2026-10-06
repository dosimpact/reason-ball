import { Activity, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import { type TriggerType, sampleTasks } from "./model";

import type { useLoopEngineeringHarness } from "./useLoopEngineeringHarness";

type Props = Pick<
  ReturnType<typeof useLoopEngineeringHarness>,
  | "task"
  | "setTask"
  | "triggerType"
  | "setTriggerType"
  | "maxAttempts"
  | "setMaxAttempts"
  | "qualityThreshold"
  | "setQualityThreshold"
  | "status"
  | "threadId"
  | "attempts"
  | "error"
  | "busy"
  | "resetView"
  | "runHarness"
>;

export function RuntimeControls({
  task,
  setTask,
  triggerType,
  setTriggerType,
  maxAttempts,
  setMaxAttempts,
  qualityThreshold,
  setQualityThreshold,
  status,
  threadId,
  attempts,
  error,
  busy,
  resetView,
  runHarness,
}: Props) {
  return (
    <aside className="artifact-chat-panel">
      <div className="panel-title">
        <Activity aria-hidden="true" size={18} />
        Harness Controls
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="sample-list" aria-label="Task samples">
        {sampleTasks.map((sample) => (
          <button
            key={sample}
            type="button"
            className="sample-button"
            onClick={() => setTask(sample)}
            disabled={busy}
          >
            {sample}
          </button>
        ))}
      </div>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void runHarness(); }}>
        <label className="field">
          <span>Trigger</span>
          <select value={triggerType} onChange={(event) => setTriggerType(event.target.value as TriggerType)}>
            <option value="manual">manual</option>
            <option value="webhook">webhook</option>
            <option value="cron">cron</option>
          </select>
        </label>
        <label className="field">
          <span>Task</span>
          <textarea value={task} onChange={(event) => setTask(event.target.value)} rows={6} />
        </label>
        <div className="two-column-grid">
          <label className="field">
            <span>Max Attempts</span>
            <input
              type="number"
              min={1}
              max={4}
              value={maxAttempts}
              onChange={(event) => setMaxAttempts(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Quality Threshold</span>
            <input
              type="number"
              min={1}
              max={5}
              value={qualityThreshold}
              onChange={(event) => setQualityThreshold(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !task.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run harness
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
          <span>Attempts</span>
          <strong>{attempts.length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
