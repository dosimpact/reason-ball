import { isNumber } from "remeda";
import { GitCompareArrows } from "lucide-react";

import { checkpointId, formatJson, metadataSource } from "./data";
import type { useCheckpointStateHistory } from "./useCheckpointStateHistory";

export function StreamEventsPanel({
  events,
}: Pick<ReturnType<typeof useCheckpointStateHistory>, "events">) {
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

export function CheckpointHistoryView({
  history,
  selectedCheckpointId,
  setSelectedCheckpointId,
}: Pick<
  ReturnType<typeof useCheckpointStateHistory>,
  "history" | "selectedCheckpointId" | "setSelectedCheckpointId"
>) {
  return (
    <div
      className="checkpoint-history-panel"
      role="region"
      aria-label="Checkpoint History"
    >
      <div className="panel-title">Checkpoint History</div>
      {history.length === 0 ? (
        <p className="muted">Run the graph to load checkpoint snapshots.</p>
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
              <strong>
                {index === 0 ? "Current head" : metadataSource(entry.metadata)}
              </strong>
              <code>{checkpointId(entry.checkpoint, entry.id)}</code>
              <small>
                {isNumber(entry.metadata?.step)
                  ? `step ${entry.metadata.step}`
                  : "step unknown"}
                {entry.writes.length
                  ? ` · writes ${entry.writes.join(", ")}`
                  : ""}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CurrentStateView({
  currentState,
}: Pick<ReturnType<typeof useCheckpointStateHistory>, "currentState">) {
  return (
    <div
      className="state-panel checkpoint-current"
      role="region"
      aria-label="Current State"
    >
      <div className="panel-title">Current State</div>
      <pre>
        {currentState ? formatJson(currentState) : "No current state yet."}
      </pre>
    </div>
  );
}

export function SelectedCheckpointView({
  selectedCheckpoint,
}: Pick<ReturnType<typeof useCheckpointStateHistory>, "selectedCheckpoint">) {
  return (
    <div
      className="state-panel checkpoint-selected"
      role="region"
      aria-label="Selected Checkpoint"
    >
      <div className="panel-title">Selected Checkpoint</div>
      {selectedCheckpoint ? (
        <pre>
          {formatJson({
            checkpoint: selectedCheckpoint.checkpoint,
            metadata: selectedCheckpoint.metadata,
            created_at: selectedCheckpoint.createdAt,
            next: selectedCheckpoint.next,
            values: selectedCheckpoint.values,
          })}
        </pre>
      ) : (
        <pre>No checkpoint selected.</pre>
      )}
    </div>
  );
}

export function StateDiffView({
  status,
  diffRows,
}: Pick<ReturnType<typeof useCheckpointStateHistory>, "status" | "diffRows">) {
  return (
    <div className="diff-panel" role="region" aria-label="State Diff">
      <div className="panel-title">
        <GitCompareArrows aria-hidden="true" size={18} />
        State Diff
      </div>
      {diffRows.length === 0 ? (
        <p className="muted">
          Select a checkpoint to compare selected value and current value.
        </p>
      ) : (
        <div className="diff-table">
          <div className="diff-heading">
            <span>Key</span>
            <span>Status</span>
            <span>Selected Value</span>
            <span>Current Value</span>
          </div>
          {diffRows.map((row) => (
            <div
              key={row.key}
              className={`diff-row ${row.status.replaceAll(" ", "-")}`}
            >
              <code>{row.key}</code>
              <strong>{row.status}</strong>
              <pre>{row.selected}</pre>
              <pre>{row.current}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
