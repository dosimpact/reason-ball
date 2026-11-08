import {
  Loader2,
  Play,
  RotateCcw,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { ambiguousRequest, completeRequest } from "./data";
import { type IntentFeedbackGenerativeController } from "./useIntentFeedbackGenerative";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  IntentFeedbackGenerativeController,
  | "userQuery"
  | "setUserQuery"
  | "threadId"
  | "status"
  | "finalStatus"
  | "error"
  | "busy"
  | "selectionComplete"
  | "resetView"
  | "runIntentCheck"
  | "continueWithSelections"
>;

export function RuntimeControls({
  userQuery,
  setUserQuery,
  threadId,
  status,
  finalStatus,
  error,
  busy,
  selectionComplete,
  resetView,
  runIntentCheck,
  continueWithSelections,
}: RuntimeControlsProps) {
  return (
    <aside className="intent-control">
      <div className="panel-title">
        <SlidersHorizontal aria-hidden="true" size={18} />
        Intent Runtime
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setUserQuery(ambiguousRequest)}
          disabled={busy}
        >
          Use ambiguous request
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setUserQuery(completeRequest)}
          disabled={busy}
        >
          Use complete request
        </button>
      </div>
      <form
        className="run-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runIntentCheck();
        }}
      >
        <label className="field">
          <span>Investor request</span>
          <textarea
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            rows={5}
          />
        </label>
        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !userQuery.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run intent check
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
      <button
        type="button"
        className="primary-button full-width-button"
        onClick={continueWithSelections}
        disabled={busy || !selectionComplete}
      >
        <Send size={16} />
        Continue with selections
      </button>
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
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
