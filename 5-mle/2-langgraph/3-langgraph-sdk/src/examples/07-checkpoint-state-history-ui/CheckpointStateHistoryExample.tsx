import { History, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import {
  CheckpointHistoryView,
  CurrentStateView,
  SelectedCheckpointView,
  StateDiffView,
  StreamEventsPanel,
} from "./ResultsPanels";
import { useCheckpointStateHistory } from "./useCheckpointStateHistory";

export function CheckpointStateHistoryExample() {
  const {
    topic,
    setTopic,
    threadId,
    status,
    currentState,
    history,
    selectedCheckpointId,
    setSelectedCheckpointId,
    events,
    error,
    busy,
    selectedCheckpoint,
    diffRows,
    resetView,
    runCheckpointHistory,
  } = useCheckpointStateHistory();
  return (
    <section className="checkpoint-layout">
      <aside className="checkpoint-control">
        <div className="panel-title">
          <History aria-hidden="true" size={18} />
          Checkpoint Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runCheckpointHistory();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Topic</span>
            <textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              rows={3}
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
              Run checkpoint history
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
            <span>Checkpoints</span>
            <strong>{history.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <CheckpointHistoryView
        history={history}
        selectedCheckpointId={selectedCheckpointId}
        setSelectedCheckpointId={setSelectedCheckpointId}
      />

      <CurrentStateView currentState={currentState} />

      <SelectedCheckpointView selectedCheckpoint={selectedCheckpoint} />

      <StateDiffView status={status} diffRows={diffRows} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
