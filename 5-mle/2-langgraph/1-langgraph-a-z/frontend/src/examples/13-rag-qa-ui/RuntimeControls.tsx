import { FileSearch, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples } from "./data";
import { type RagQaController } from "./useRagQa";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  RagQaController,
  | "question"
  | "setQuestion"
  | "threadId"
  | "status"
  | "retrievedDocs"
  | "error"
  | "busy"
  | "resetView"
  | "runRagQa"
>;

export function RuntimeControls({
  question,
  setQuestion,
  threadId,
  status,
  retrievedDocs,
  error,
  busy,
  resetView,
  runRagQa,
}: RuntimeControlsProps) {
  return (
    <aside className="rag-control">
      <div className="panel-title">
        <FileSearch aria-hidden="true" size={18} />
        RAG Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="sample-list" aria-label="RAG QA samples">
        {samples.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="sample-button"
            onClick={() => setQuestion(sample.value)}
            disabled={busy}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runRagQa();
        }}
        className="run-form"
      >
        <label className="field">
          <span>Question</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={6}
          />
        </label>
        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !question.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run RAG QA
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
          <span>Docs</span>
          <strong>{retrievedDocs.length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
