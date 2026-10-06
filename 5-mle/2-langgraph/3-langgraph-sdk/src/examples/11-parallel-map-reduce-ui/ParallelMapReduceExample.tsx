import { Loader2, Play, RotateCcw, Workflow } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples } from "./data";
import {
  FinalStateView,
  ReducerInputsView,
  ResultsPanel,
  StreamEventsPanel,
  WorkerProgressView,
} from "./ResultsPanels";
import { useParallelMapReduce } from "./useParallelMapReduce";

export function ParallelMapReduceExample() {
  const {
    topic,
    setTopic,
    threadId,
    status,
    workers,
    reducerInputs,
    reducerOutput,
    finalState,
    events,
    error,
    busy,
    resetView,
    runMapReduce,
  } = useParallelMapReduce();
  return (
    <section className="parallel-layout">
      <aside className="parallel-control">
        <div className="panel-title">
          <Workflow aria-hidden="true" size={18} />
          Map-Reduce Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="sample-list" aria-label="Map-reduce samples">
          {samples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="sample-button"
              onClick={() => setTopic(sample.value)}
              disabled={busy}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runMapReduce();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Topic</span>
            <textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              rows={5}
            />
          </label>
          <div className="button-row">
            <button
              type="submit"
              className="primary-button"
              disabled={busy || !topic.trim()}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              Run map-reduce
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
            <span>Workers</span>
            <strong>{workers.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <WorkerProgressView status={status} workers={workers} />

      <ReducerInputsView status={status} reducerInputs={reducerInputs} />

      <ResultsPanel reducerOutput={reducerOutput} />

      <FinalStateView finalState={finalState} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
