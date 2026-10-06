import { Loader2, Play, RotateCcw, Volume2 } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import { formats, voices } from "./model";

import type { useMultimodalVoiceOutput } from "./useMultimodalVoiceOutput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceOutput>,
  | "prompt"
  | "setPrompt"
  | "voice"
  | "setVoice"
  | "responseFormat"
  | "setResponseFormat"
  | "speechInstructions"
  | "setSpeechInstructions"
  | "threadId"
  | "status"
  | "error"
  | "busy"
  | "resetResultState"
  | "runVoiceOutput"
>;

export function RuntimeControls({
  prompt,
  setPrompt,
  voice,
  setVoice,
  responseFormat,
  setResponseFormat,
  speechInstructions,
  setSpeechInstructions,
  threadId,
  status,
  error,
  busy,
  resetResultState,
  runVoiceOutput,
}: Props) {
  return (
    <aside className="voice-output-control">
      <div className="panel-title">
        <Volume2 aria-hidden="true" size={18} />
        Voice Output Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void runVoiceOutput(); }}>
        <label className="field">
          <span>Response prompt</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
        </label>
        <div className="voice-output-selector-grid">
          <label className="field">
            <span>Voice</span>
            <select value={voice} onChange={(event) => setVoice(event.target.value)} disabled={busy}>
              {voices.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Audio format</span>
            <select value={responseFormat} onChange={(event) => setResponseFormat(event.target.value)} disabled={busy}>
              {formats.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Speech instructions</span>
          <textarea
            value={speechInstructions}
            onChange={(event) => setSpeechInstructions(event.target.value)}
            rows={3}
          />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run voice output
          </button>
          <button type="button" className="secondary-button" onClick={resetResultState} disabled={busy}>
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
          <span>Voice</span>
          <strong>{voice} / {responseFormat}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
