import {
  BookOpenText,
  FileSearch,
  Link2,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { evidenceQuestion, streamQuestion } from "./data";
import { type ChatCitationRendererController } from "./useChatCitationRenderer";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  ChatCitationRendererController,
  | "question"
  | "setQuestion"
  | "threadId"
  | "status"
  | "citations"
  | "error"
  | "busy"
  | "resetView"
  | "runCitationRenderer"
>;

export function RuntimeControls({
  question,
  setQuestion,
  threadId,
  status,
  citations,
  error,
  busy,
  resetView,
  runCitationRenderer,
}: RuntimeControlsProps) {
  return (
    <aside className="chat-citation-control">
      <div className="panel-title">
        <FileSearch aria-hidden="true" size={18} />
        Citation Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setQuestion(evidenceQuestion)}
          disabled={busy}
        >
          <BookOpenText size={16} />
          Use evidence sample
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setQuestion(streamQuestion)}
          disabled={busy}
        >
          <Link2 size={16} />
          Use stream sample
        </button>
      </div>
      <form
        className="run-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runCitationRenderer();
        }}
      >
        <label className="field">
          <span>Citation question</span>
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
            Run citation renderer
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
          <span>Citations</span>
          <strong>{citations.length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
