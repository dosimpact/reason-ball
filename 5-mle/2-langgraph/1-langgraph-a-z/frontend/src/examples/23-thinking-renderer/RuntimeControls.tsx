import { Brain, CheckCircle2, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { analysisPrompt, supportPrompt } from "./data";
import { type ThinkingRendererController } from "./useThinkingRenderer";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  ThinkingRendererController,
  | "question"
  | "setQuestion"
  | "threadId"
  | "runId"
  | "status"
  | "error"
  | "busy"
  | "resetView"
  | "runThinkingRenderer"
>;

export function RuntimeControls({
  question,
  setQuestion,
  threadId,
  runId,
  status,
  error,
  busy,
  resetView,
  runThinkingRenderer,
}: RuntimeControlsProps) {
  return (
    <aside className="thinking-control">
      <div className="panel-title">
        <Brain aria-hidden="true" size={18} />
        Thinking Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setQuestion(analysisPrompt)}
          disabled={busy}
        >
          <Brain size={16} />
          Use analysis sample
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setQuestion(supportPrompt)}
          disabled={busy}
        >
          <CheckCircle2 size={16} />
          Use support sample
        </button>
      </div>
      <form
        className="run-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runThinkingRenderer();
        }}
      >
        <label className="field">
          <span>Thinking prompt</span>
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
            Run thinking renderer
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
          <span>Run ID</span>
          <strong>{runId || "none"}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
