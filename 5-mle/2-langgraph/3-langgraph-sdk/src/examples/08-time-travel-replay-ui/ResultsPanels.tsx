import { GitBranch, GitCompareArrows, History, Loader2 } from "lucide-react";

import { formatJson } from "./data";
import type { useTimeTravelReplay } from "./useTimeTravelReplay";

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useTimeTravelReplay>, "events">) {
  return (
    <div className="event-panel" role="region" aria-label="Raw Stream Events">
      <div className="panel-title">Raw Stream Events</div>
      <div className="event-list compact">
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          events.map((entry) => (
            <details key={entry.id} className="event-row">
              <summary>
                <span>{entry.receivedAt}</span>
                <strong>{entry.event}</strong>
              </summary>
              <pre>{formatJson(entry.data)}</pre>
            </details>
          ))
        )}
      </div>
    </div>
  );
}

export function ReplayControlsView({
  replayTopic,
  setReplayTopic,
  replayInstruction,
  setReplayInstruction,
  threadId,
  replaySourceCheckpointId,
  busy,
  selectedCheckpoint,
  runReplay,
}: Pick<
  ReturnType<typeof useTimeTravelReplay>,
  | "replayTopic"
  | "setReplayTopic"
  | "replayInstruction"
  | "setReplayInstruction"
  | "threadId"
  | "replaySourceCheckpointId"
  | "busy"
  | "selectedCheckpoint"
  | "runReplay"
>) {
  return (
    <div className="replay-panel" role="region" aria-label="Replay Controls">
      <div className="panel-title">Replay Controls</div>
      <label className="field">
        <span>Replay Topic</span>
        <textarea
          value={replayTopic}
          onChange={(event) => setReplayTopic(event.target.value)}
          rows={3}
        />
      </label>
      <label className="field">
        <span>Replay Instruction</span>
        <textarea
          value={replayInstruction}
          onChange={(event) => setReplayInstruction(event.target.value)}
          rows={3}
        />
      </label>
      <button
        type="button"
        className="primary-button full-width-button"
        onClick={() => void runReplay()}
        disabled={
          busy || !threadId || !selectedCheckpoint || !replayTopic.trim()
        }
      >
        {busy ? (
          <Loader2 className="spin" size={16} />
        ) : (
          <GitBranch size={16} />
        )}
        Replay from selected checkpoint
      </button>
      <div className="replay-source">
        <span>Selected checkpoint</span>
        <code>{selectedCheckpoint?.id ?? "none"}</code>
        <span>Replay source</span>
        <code>{replaySourceCheckpointId || "not replayed yet"}</code>
      </div>
    </div>
  );
}

export function CheckpointHistoryView({
  history,
  selectedCheckpointId,
  setSelectedCheckpointId,
}: Pick<
  ReturnType<typeof useTimeTravelReplay>,
  "history" | "selectedCheckpointId" | "setSelectedCheckpointId"
>) {
  return (
    <div
      className="checkpoint-history-panel"
      role="region"
      aria-label="Checkpoint History"
    >
      <div className="panel-title">
        <History aria-hidden="true" size={18} />
        Checkpoint History
      </div>
      {history.length === 0 ? (
        <p className="muted">
          Run the original timeline to load replay checkpoints.
        </p>
      ) : (
        <div className="checkpoint-list">
          {history.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              className={
                entry.id === selectedCheckpointId
                  ? "checkpoint-item active"
                  : "checkpoint-item"
              }
              onClick={() => setSelectedCheckpointId(entry.id)}
              aria-pressed={entry.id === selectedCheckpointId}
            >
              <span>{entry.label}</span>
              <strong>{index === 0 ? "Current head" : entry.stage}</strong>
              <code>{entry.id}</code>
              <small>{entry.step}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SelectedCheckpointView({
  selectedCheckpoint,
}: Pick<ReturnType<typeof useTimeTravelReplay>, "selectedCheckpoint">) {
  return (
    <div
      className="state-panel replay-selected"
      role="region"
      aria-label="Selected Checkpoint"
    >
      <div className="panel-title">Selected Checkpoint</div>
      <pre>
        {selectedCheckpoint
          ? formatJson({
              checkpoint: selectedCheckpoint.checkpoint,
              metadata: selectedCheckpoint.metadata,
              created_at: selectedCheckpoint.createdAt,
              next: selectedCheckpoint.next,
              values: selectedCheckpoint.values,
            })
          : "No checkpoint selected."}
      </pre>
    </div>
  );
}

export function ReplayResultGridView({
  originalResult,
  replayResult,
}: Pick<
  ReturnType<typeof useTimeTravelReplay>,
  "originalResult" | "replayResult"
>) {
  return (
    <div className="replay-result-grid">
      <div className="result-panel" role="region" aria-label="Original Result">
        <div className="panel-title">Original Result</div>
        <div className="answer-box">
          {originalResult || "No original result yet."}
        </div>
      </div>
      <div className="result-panel" role="region" aria-label="Replay Result">
        <div className="panel-title">Replay Result</div>
        <div className="answer-box">
          {replayResult || "No replay result yet."}
        </div>
      </div>
    </div>
  );
}

export function ReplayComparisonView({
  status,
  replaySourceCheckpointId,
  comparisonRows,
  changedRows,
}: Pick<
  ReturnType<typeof useTimeTravelReplay>,
  "status" | "replaySourceCheckpointId" | "comparisonRows" | "changedRows"
>) {
  return (
    <div className="diff-panel" role="region" aria-label="Replay Comparison">
      <div className="panel-title">
        <GitCompareArrows aria-hidden="true" size={18} />
        Replay Comparison
      </div>
      {comparisonRows.length === 0 ? (
        <p className="muted">
          Run a replay branch to compare original and replay state values.
        </p>
      ) : (
        <>
          <p className="comparison-summary">
            Replay fork changed {changedRows.length} state fields from
            checkpoint <code>{replaySourceCheckpointId}</code>.
          </p>
          <div className="diff-table">
            <div className="diff-heading">
              <span>Key</span>
              <span>Status</span>
              <span>Original Value</span>
              <span>Replay Value</span>
            </div>
            {comparisonRows.map((row) => (
              <div
                key={row.key}
                className={`diff-row ${row.status.replaceAll(" ", "-")}`}
              >
                <code>{row.key}</code>
                <strong>{row.status}</strong>
                <pre>{row.original}</pre>
                <pre>{row.replay}</pre>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
