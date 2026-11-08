import {
  Activity,
  BarChart3,
  Clock3,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { toolQuery, summaryQuery } from "./data";
import { type ObservabilityController } from "./useObservability";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  ObservabilityController,
  | "query"
  | "setQuery"
  | "threadId"
  | "runId"
  | "status"
  | "error"
  | "busy"
  | "resetView"
  | "runObservableGraph"
>;

export function RuntimeControls({
  query,
  setQuery,
  threadId,
  runId,
  status,
  error,
  busy,
  resetView,
  runObservableGraph,
}: RuntimeControlsProps) {
  return (
    <aside className="observability-control">
      <div className="panel-title">
        <Activity aria-hidden="true" size={18} />
        Observable Run
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setQuery(toolQuery)}
          disabled={busy}
        >
          <Clock3 size={16} />
          Use tool query
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setQuery(summaryQuery)}
          disabled={busy}
        >
          <BarChart3 size={16} />
          Use summary query
        </button>
      </div>
      <form
        className="run-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runObservableGraph();
        }}
      >
        <label className="field">
          <span>Observable query</span>
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={5}
          />
        </label>
        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !query.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run observable graph
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
