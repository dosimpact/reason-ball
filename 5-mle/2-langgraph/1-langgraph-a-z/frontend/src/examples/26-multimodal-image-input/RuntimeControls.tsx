import { FileImage, ImagePlus, Loader2, Play, RotateCcw, ScanSearch } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import { alternatePrompt } from "./model";

import type { useMultimodalImageInput } from "./useMultimodalImageInput";

type Props = Pick<
  ReturnType<typeof useMultimodalImageInput>,
  | "prompt"
  | "setPrompt"
  | "imageDataUrl"
  | "imageName"
  | "validationError"
  | "threadId"
  | "status"
  | "error"
  | "busy"
  | "fileInputRef"
  | "resetView"
  | "handleFileChange"
  | "loadSampleImage"
  | "runImageAnalysis"
>;

export function RuntimeControls({
  prompt,
  setPrompt,
  imageDataUrl,
  imageName,
  validationError,
  threadId,
  status,
  error,
  busy,
  fileInputRef,
  resetView,
  handleFileChange,
  loadSampleImage,
  runImageAnalysis,
}: Props) {
  return (
    <aside className="image-input-control">
      <div className="panel-title">
        <FileImage aria-hidden="true" size={18} />
        Image Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={loadSampleImage} disabled={busy}>
          <ImagePlus size={16} />
          Use sample image
        </button>
        <button type="button" className="secondary-button" onClick={() => setPrompt(alternatePrompt)} disabled={busy}>
          <ScanSearch size={16} />
          Use region prompt
        </button>
      </div>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void runImageAnalysis(); }}>
        <label className="field">
          <span>Image file</span>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleFileChange(event.target.files?.[0]); }} />
        </label>
        <label className="field">
          <span>Image prompt</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !prompt.trim() || !imageDataUrl}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run image analysis
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
          <span>Image</span>
          <strong>{imageName || "none"}</strong>
        </div>
      </div>
      {validationError ? <p className="error-line">{validationError}</p> : null}
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
