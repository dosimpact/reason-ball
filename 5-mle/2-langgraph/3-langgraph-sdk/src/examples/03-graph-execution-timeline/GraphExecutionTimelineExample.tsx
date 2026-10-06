import { Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import {
  StatePanelView,
  StreamEventsPanel,
  TimelinePanelView,
} from "./ResultsPanels";
import { useGraphExecutionTimeline } from "./useGraphExecutionTimeline";

export function GraphExecutionTimelineExample() {
  const {
    topic,
    setTopic,
    threadId,
    status,
    nodes,
    finalState,
    events,
    error,
    busy,
    resetView,
    runTimeline,
  } = useGraphExecutionTimeline();
  return (
    <section className="timeline-layout">
      <div className="timeline-control">
        <div className="panel-title">Run Controls</div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runTimeline();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Topic</span>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
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
              Run timeline
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
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </div>

      <TimelinePanelView status={status} nodes={nodes} />

      <StatePanelView finalState={finalState} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
