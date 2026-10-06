import { AudioLines, Loader2, Mic2, Play, RotateCcw, Upload } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import { alternatePrompt } from "./model";

import type { useMultimodalVoiceInput } from "./useMultimodalVoiceInput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceInput>,
  | "prompt"
  | "setPrompt"
  | "audioDataUrl"
  | "audioName"
  | "validationError"
  | "threadId"
  | "status"
  | "error"
  | "busy"
  | "fileInputRef"
  | "resetView"
  | "handleFileChange"
  | "loadSampleAudio"
  | "runVoiceAnalysis"
>;

export function RuntimeControls({
  prompt,
  setPrompt,
  audioDataUrl,
  audioName,
  validationError,
  threadId,
  status,
  error,
  busy,
  fileInputRef,
  resetView,
  handleFileChange,
  loadSampleAudio,
  runVoiceAnalysis,
}: Props) {
  return (
    <aside className="voice-input-control">
      <div className="panel-title">
        <Mic2 aria-hidden="true" size={18} />
        Voice Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={loadSampleAudio} disabled={busy}>
          <AudioLines size={16} />
          Use sample audio
        </button>
        <button type="button" className="secondary-button" onClick={() => setPrompt(alternatePrompt)} disabled={busy}>
          <Upload size={16} />
          Use metadata prompt
        </button>
      </div>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void runVoiceAnalysis(); }}>
        <label className="field">
          <span>Audio file</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/aac,audio/flac,audio/m4a,audio/mp4,audio/mpeg,audio/mp3,audio/mpga,audio/ogg,audio/wav,audio/webm"
            onChange={(event) => { void handleFileChange(event.target.files?.[0]); }}
          />
        </label>
        <label className="field">
          <span>Voice prompt</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !prompt.trim() || !audioDataUrl}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run voice analysis
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
          <span>Audio</span>
          <strong>{audioName || "none"}</strong>
        </div>
      </div>
      {validationError ? <p className="error-line">{validationError}</p> : null}
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
