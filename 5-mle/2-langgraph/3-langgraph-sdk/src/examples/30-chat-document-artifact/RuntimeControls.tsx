import { FileText, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import { lengths, sections, tones } from "./model";

import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "userRequest"
  | "setUserRequest"
  | "tone"
  | "setTone"
  | "targetLength"
  | "setTargetLength"
  | "focusSection"
  | "setFocusSection"
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
  tone,
  setTone,
  targetLength,
  setTargetLength,
  focusSection,
  setFocusSection,
  threadId,
  status,
  artifactVersion,
  error,
  busy,
  resetView,
  submitProposal,
}: Props) {
  return (
    <aside className="document-control">
      <div className="panel-title">
        <FileText aria-hidden="true" size={18} />
        Document Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void submitProposal(); }}>
        <label className="field">
          <span>Document request</span>
          <textarea value={userRequest} onChange={(event) => setUserRequest(event.target.value)} rows={5} />
        </label>
        <div className="document-selector-grid">
          <label className="field">
            <span>Tone</span>
            <select value={tone} onChange={(event) => setTone(event.target.value)} disabled={busy}>
              {tones.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Length</span>
            <select value={targetLength} onChange={(event) => setTargetLength(event.target.value)} disabled={busy}>
              {lengths.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Focus section</span>
          <select value={focusSection} onChange={(event) => setFocusSection(event.target.value)} disabled={busy}>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !userRequest.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run document agent
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
