import { Layers3, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples } from "./data";
import {
  BreadcrumbView,
  FinalStateView,
  NestedExecutionTreeView,
  ParentStateView,
  ResultsPanel,
  StreamEventsPanel,
  SubgraphStateView,
} from "./ResultsPanels";
import { useSubgraphNestedExecution } from "./useSubgraphNestedExecution";

export function SubgraphNestedExecutionExample() {
  const {
    request,
    setRequest,
    threadId,
    status,
    selectedTeam,
    breadcrumb,
    parentSteps,
    subgraphSteps,
    parentMessages,
    subgraphMessages,
    parentState,
    subgraphState,
    finalState,
    final,
    events,
    error,
    busy,
    resetView,
    runNestedGraph,
  } = useSubgraphNestedExecution();
  return (
    <section className="nested-layout">
      <aside className="nested-control">
        <div className="panel-title">
          <Layers3 aria-hidden="true" size={18} />
          Nested Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="sample-list" aria-label="Nested samples">
          {samples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="sample-button"
              onClick={() => setRequest(sample.value)}
              disabled={busy}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runNestedGraph();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Request</span>
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              rows={5}
            />
          </label>
          <div className="button-row">
            <button
              type="submit"
              className="primary-button"
              disabled={busy || !request.trim()}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              Run nested graph
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
            <span>Team</span>
            <strong>{selectedTeam || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <BreadcrumbView breadcrumb={breadcrumb} />

      <NestedExecutionTreeView
        selectedTeam={selectedTeam}
        parentSteps={parentSteps}
        subgraphSteps={subgraphSteps}
      />

      <ParentStateView
        parentMessages={parentMessages}
        parentState={parentState}
      />

      <SubgraphStateView
        subgraphMessages={subgraphMessages}
        subgraphState={subgraphState}
      />

      <ResultsPanel final={final} />

      <FinalStateView finalState={finalState} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
