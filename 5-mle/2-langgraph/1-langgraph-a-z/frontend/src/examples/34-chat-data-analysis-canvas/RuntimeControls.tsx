import { Database, Loader2, Play, RotateCcw, Upload } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "userRequest"
  | "setUserRequest"
  | "csvText"
  | "setCsvText"
  | "threadId"
  | "status"
  | "datasetName"
  | "setDatasetName"
  | "retryCount"
  | "error"
  | "uploadStatus"
  | "busy"
  | "resetView"
  | "runAnalysis"
  | "handleCsvUpload"
>;

export function RuntimeControls({
  userRequest,
  setUserRequest,
  csvText,
  setCsvText,
  threadId,
  status,
  datasetName,
  setDatasetName,
  retryCount,
  error,
  uploadStatus,
  busy,
  resetView,
  runAnalysis,
  handleCsvUpload,
}: Props) {
  return (
    <aside className="data-canvas-control">
      <div className="panel-title">
        <Database aria-hidden="true" size={18} />
        Data Canvas Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); void runAnalysis(); }}>
        <label className="field">
          <span>Analysis request</span>
          <textarea value={userRequest} onChange={(event) => setUserRequest(event.target.value)} rows={4} />
        </label>
        <label className="field">
          <span>Dataset name</span>
          <input value={datasetName} onChange={(event) => setDatasetName(event.target.value)} />
        </label>
        <label className="field">
          <span>CSV upload</span>
          <input type="file" accept=".csv,text/csv" onChange={(event) => void handleCsvUpload(event.target.files?.[0])} disabled={busy} />
        </label>
        <p className="field-help">
          <Upload aria-hidden="true" size={14} />
          {uploadStatus}
        </p>
        <label className="field">
          <span>CSV data</span>
          <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={7} />
        </label>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={busy || !userRequest.trim() || !csvText.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run analysis
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
          <span>Retries</span>
          <strong>{retryCount}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
