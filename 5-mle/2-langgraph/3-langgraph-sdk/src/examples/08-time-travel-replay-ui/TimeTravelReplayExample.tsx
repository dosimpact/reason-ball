import { GitBranch, Loader2, Play, RotateCcw } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import {
  CheckpointHistoryView,
  ReplayComparisonView,
  ReplayControlsView,
  ReplayResultGridView,
  SelectedCheckpointView,
  StreamEventsPanel,
} from "./ResultsPanels";
import { useTimeTravelReplay } from "./useTimeTravelReplay";

export function TimeTravelReplayExample() {
  const {
    topic,
    setTopic,
    replayTopic,
    setReplayTopic,
    replayInstruction,
    setReplayInstruction,
    threadId,
    status,
    history,
    selectedCheckpointId,
    setSelectedCheckpointId,
    replaySourceCheckpointId,
    events,
    error,
    busy,
    selectedCheckpoint,
    comparisonRows,
    changedRows,
    resetView,
    runOriginal,
    runReplay,
    originalResult,
    replayResult,
  } = useTimeTravelReplay();
  return (
    <section className="replay-layout">
      <aside className="replay-control">
        <div className="panel-title">
          <GitBranch aria-hidden="true" size={18} />
          Replay Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runOriginal();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Original Topic</span>
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
              Run original timeline
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

      <ReplayControlsView
        replayTopic={replayTopic}
        setReplayTopic={setReplayTopic}
        replayInstruction={replayInstruction}
        setReplayInstruction={setReplayInstruction}
        threadId={threadId}
        replaySourceCheckpointId={replaySourceCheckpointId}
        busy={busy}
        selectedCheckpoint={selectedCheckpoint}
        runReplay={runReplay}
      />

      <CheckpointHistoryView
        history={history}
        selectedCheckpointId={selectedCheckpointId}
        setSelectedCheckpointId={setSelectedCheckpointId}
      />

      <SelectedCheckpointView selectedCheckpoint={selectedCheckpoint} />

      <ReplayResultGridView
        originalResult={originalResult}
        replayResult={replayResult}
      />

      <ReplayComparisonView
        status={status}
        replaySourceCheckpointId={replaySourceCheckpointId}
        comparisonRows={comparisonRows}
        changedRows={changedRows}
      />

      <StreamEventsPanel events={events} />
    </section>
  );
}
