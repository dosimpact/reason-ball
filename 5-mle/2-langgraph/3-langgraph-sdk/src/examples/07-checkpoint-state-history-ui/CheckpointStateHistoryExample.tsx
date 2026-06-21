import { GitCompareArrows, History, Loader2, Play, RotateCcw } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultTopic = "debugging LangGraph state changes with checkpoints";

type JsonRecord = Record<string, unknown>;

type ThreadCheckpoint = {
  checkpoint_id?: string;
  checkpointId?: string;
  checkpoint_ns?: string;
  checkpointNs?: string;
  thread_id?: string;
  threadId?: string;
};

type ThreadStateRecord = {
  values?: unknown;
  checkpoint?: ThreadCheckpoint | null;
  metadata?: JsonRecord | null;
  created_at?: string | null;
  parent_checkpoint?: ThreadCheckpoint | null;
  next?: string[];
  tasks?: unknown[];
};

type HistoryEntry = {
  id: string;
  label: string;
  values: JsonRecord;
  checkpoint: ThreadCheckpoint | null;
  metadata: JsonRecord | null;
  createdAt: string;
  next: string[];
  writes: string[];
};

type DiffStatus = "added in current" | "removed from current" | "changed" | "same";

type DiffRow = {
  key: string;
  status: DiffStatus;
  selected: string;
  current: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(value: unknown): JsonRecord {
  if (isRecord(value) && isRecord(value.values)) return value.values;
  return isRecord(value) ? value : {};
}

function checkpointId(checkpoint: ThreadCheckpoint | null | undefined, fallback: string) {
  return checkpoint?.checkpoint_id ?? checkpoint?.checkpointId ?? fallback;
}

function metadataSource(metadata: JsonRecord | null): string {
  return typeof metadata?.source === "string" ? metadata.source : "history";
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatValue(value: unknown): string {
  return value === undefined ? "undefined" : formatJson(value);
}

function normalizeHistory(history: unknown): HistoryEntry[] {
  if (!Array.isArray(history)) return [];
  return history.map((item, index) => {
    const record = isRecord(item) ? (item as ThreadStateRecord) : ({} as ThreadStateRecord);
    const metadata = isRecord(record.metadata) ? record.metadata : null;
    const writes = isRecord(metadata?.writes) ? Object.keys(metadata.writes) : [];
    const checkpoint = record.checkpoint ?? null;
    const id = checkpointId(checkpoint, `checkpoint-${index + 1}`);
    return {
      id,
      label: `Checkpoint ${index + 1}`,
      values: valuesOf(record.values),
      checkpoint,
      metadata,
      createdAt: record.created_at ?? "",
      next: Array.isArray(record.next) ? record.next : [],
      writes,
    };
  });
}

function buildDiff(selected: JsonRecord, current: JsonRecord): DiffRow[] {
  const keys = Array.from(new Set([...Object.keys(selected), ...Object.keys(current)])).sort();
  return keys.map((key) => {
    const selectedValue = selected[key];
    const currentValue = current[key];
    const selectedText = formatValue(selectedValue);
    const currentText = formatValue(currentValue);
    let status: DiffStatus = "same";
    if (!(key in selected)) status = "added in current";
    else if (!(key in current)) status = "removed from current";
    else if (selectedText !== currentText) status = "changed";
    return { key, status, selected: selectedText, current: currentText };
  });
}

export function CheckpointStateHistoryExample() {
  const [topic, setTopic] = useState(defaultTopic);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [currentState, setCurrentState] = useState<JsonRecord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);
  const selectedCheckpoint = history.find((entry) => entry.id === selectedCheckpointId) ?? null;
  const diffRows = buildDiff(selectedCheckpoint?.values ?? {}, currentState ?? {});

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setCurrentState(null);
    setHistory([]);
    setSelectedCheckpointId("");
    setEvents([]);
    setError("");
  }

  async function refreshStateAndHistory(activeThreadId: string) {
    const [state, historyPage] = await Promise.all([
      client.threads.getState(activeThreadId),
      client.threads.getHistory(activeThreadId, { limit: 20 }),
    ]);
    const currentValues = valuesOf(state);
    const normalized = normalizeHistory(historyPage);
    setCurrentState(currentValues);
    setHistory(normalized);
    setSelectedCheckpointId(normalized[1]?.id ?? normalized[0]?.id ?? "");
  }

  async function runCheckpointHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setCurrentState(null);
    setHistory([]);
    setSelectedCheckpointId("");
    setStatus("Creating thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "07-checkpoint-state-history-ui", topic: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming checkpointed run");

      const stream = await client.runs.stream(nextThreadId, "07_checkpoint_state_history", {
        input: { topic: trimmed },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        setStatus(`Streaming: ${logEntry.event}`);
      }

      await refreshStateAndHistory(nextThreadId);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

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
        <form onSubmit={runCheckpointHistory} className="run-form">
          <label className="field">
            <span>Topic</span>
            <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={3} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !topic.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run checkpoint history
            </button>
            <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
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

      <div className="checkpoint-history-panel" role="region" aria-label="Checkpoint History">
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
                  entry.id === selectedCheckpointId ? "checkpoint-item active" : "checkpoint-item"
                }
                onClick={() => setSelectedCheckpointId(entry.id)}
                aria-pressed={entry.id === selectedCheckpointId}
              >
                <span>{entry.label}</span>
                <strong>{index === 0 ? "Current head" : metadataSource(entry.metadata)}</strong>
                <code>{checkpointId(entry.checkpoint, entry.id)}</code>
                <small>
                  {typeof entry.metadata?.step === "number"
                    ? `step ${entry.metadata.step}`
                    : "step unknown"}
                  {entry.writes.length ? ` · writes ${entry.writes.join(", ")}` : ""}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="state-panel checkpoint-current" role="region" aria-label="Current State">
        <div className="panel-title">Current State</div>
        <pre>{currentState ? formatJson(currentState) : "No current state yet."}</pre>
      </div>

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

      <div className="diff-panel" role="region" aria-label="State Diff">
        <div className="panel-title">
          <GitCompareArrows aria-hidden="true" size={18} />
          State Diff
        </div>
        {diffRows.length === 0 ? (
          <p className="muted">Select a checkpoint to compare selected value and current value.</p>
        ) : (
          <div className="diff-table">
            <div className="diff-heading">
              <span>Key</span>
              <span>Status</span>
              <span>Selected Value</span>
              <span>Current Value</span>
            </div>
            {diffRows.map((row) => (
              <div key={row.key} className={`diff-row ${row.status.replaceAll(" ", "-")}`}>
                <code>{row.key}</code>
                <strong>{row.status}</strong>
                <pre>{row.selected}</pre>
                <pre>{row.current}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </section>
  );
}
