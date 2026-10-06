import { Eye, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "userRequest"
  | "setUserRequest"
  | "threadId"
  | "status"
  | "artifactVersion"
  | "error"
  | "busy"
  | "resetView"
  | "runPreview"
>;

export function RuntimeControls({
  userRequest,
  setUserRequest,
  threadId,
  status,
  artifactVersion,
  error,
  busy,
  resetView,
  runPreview,
}: Props) {
  return (
    <aside className="ui-preview-control">
      <div className="panel-title">
        <Eye aria-hidden="true" size={18} />
        UI Preview Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void runPreview(); }}>
        <label className="field">
          <span>UI request</span>
          <textarea value={userRequest} onChange={(event) => setUserRequest(event.target.value)} rows={5} />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !userRequest.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run UI preview
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
