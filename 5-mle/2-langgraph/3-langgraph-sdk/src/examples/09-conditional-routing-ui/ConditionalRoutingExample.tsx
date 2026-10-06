import { Loader2, Play, RotateCcw, Route } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples } from "./data";
import {
  BranchMapView,
  FinalStateView,
  ResultsPanel,
  RouteDecisionView,
  StreamEventsPanel,
} from "./ResultsPanels";
import { useConditionalRouting } from "./useConditionalRouting";

export function ConditionalRoutingExample() {
  const {
    request,
    setRequest,
    threadId,
    status,
    selectedBranch,
    routeReason,
    skippedBranches,
    branches,
    branchResult,
    finalState,
    events,
    error,
    busy,
    resetView,
    runRoute,
  } = useConditionalRouting();
  return (
    <section className="routing-layout">
      <aside className="routing-control">
        <div className="panel-title">
          <Route aria-hidden="true" size={18} />
          Routing Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="sample-list" aria-label="Routing samples">
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
            void runRoute();
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
              Run conditional route
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
            <span>Selected</span>
            <strong>{selectedBranch || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <RouteDecisionView
        selectedBranch={selectedBranch}
        routeReason={routeReason}
        skippedBranches={skippedBranches}
      />

      <BranchMapView status={status} branches={branches} />

      <ResultsPanel branchResult={branchResult} />

      <FinalStateView finalState={finalState} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
