import { Code2, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import { files } from "./model";

import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "userRequest"
  | "setUserRequest"
  | "selectedFile"
  | "setSelectedFile"
  | "threadId"
  | "status"
  | "artifactVersion"
  | "error"
  | "busy"
  | "resetView"
  | "submitProposal"
>;

export function RuntimeControls({
  userRequest,
  setUserRequest,
  selectedFile,
  setSelectedFile,
  threadId,
  status,
  artifactVersion,
  error,
  busy,
  resetView,
  submitProposal,
}: Props) {
  return (
    <aside className="code-editor-control">
      <div className="panel-title">
        <Code2 aria-hidden="true" size={18} />
        Code Editor Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void submitProposal(); }}>
        <label className="field">
          <span>Change request</span>
          <textarea
            value={userRequest}
            onChange={(event) => setUserRequest(event.target.value)}
            rows={5}
          />
        </label>
        <label className="field">
          <span>File</span>
          <select value={selectedFile} onChange={(event) => setSelectedFile(event.target.value)} disabled={busy}>
            {files.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !userRequest.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run code agent
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
