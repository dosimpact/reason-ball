import { ClipboardList, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import type { useChatPlanBoard } from "./useChatPlanBoard";

type Props = Pick<
  ReturnType<typeof useChatPlanBoard>,
  | "userGoal"
  | "setUserGoal"
  | "revisionNote"
  | "setRevisionNote"
  | "threadId"
  | "status"
  | "artifactVersion"
  | "error"
  | "busy"
  | "resetView"
  | "submitPlan"
>;

export function RuntimeControls({
  userGoal,
  setUserGoal,
  revisionNote,
  setRevisionNote,
  threadId,
  status,
  artifactVersion,
  error,
  busy,
  resetView,
  submitPlan,
}: Props) {
  return (
    <aside className="plan-board-control">
      <div className="panel-title">
        <ClipboardList aria-hidden="true" size={18} />
        Plan Board Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void submitPlan(); }}>
        <label className="field">
          <span>Goal</span>
          <textarea value={userGoal} onChange={(event) => setUserGoal(event.target.value)} rows={5} />
        </label>
        <label className="field">
          <span>Revision note</span>
          <textarea value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} rows={3} />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !userGoal.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run plan board
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
