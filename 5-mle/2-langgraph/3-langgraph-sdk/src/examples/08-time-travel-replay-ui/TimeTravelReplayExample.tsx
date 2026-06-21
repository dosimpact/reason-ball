import { GitBranch, GitCompareArrows, History, Loader2, Play, RotateCcw } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();
const defaultTopic = "debugging replay branches from checkpoint history";
const defaultReplayTopic = "forked replay branch with stricter rollback guidance";
const defaultReplayInstruction =
  "Emphasize how the fork changed the outcome while preserving the original checkpoint.";

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
  next?: string[];
};

type HistoryEntry = {
  id: string;
  label: string;
  values: JsonRecord;
  checkpoint: ThreadCheckpoint | null;
  metadata: JsonRecord | null;
  createdAt: string;
  next: string[];
  stage: string;
  step: string;
};

type ComparisonRow = {
  key: string;
  original: string;
  replay: string;
  status: "changed" | "same" | "added in replay" | "removed in replay";
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
    const values = valuesOf(record.values);
    const metadata = isRecord(record.metadata) ? record.metadata : null;
    const checkpoint = record.checkpoint ?? null;
    const id = checkpointId(checkpoint, `checkpoint-${index + 1}`);
    return {
      id,
      label: `Checkpoint ${index + 1}`,
      values,
      checkpoint,
      metadata,
      createdAt: record.created_at ?? "",
      next: Array.isArray(record.next) ? record.next : [],
      stage: typeof values.stage === "string" ? values.stage : "unknown",
      step: typeof metadata?.step === "number" ? `step ${metadata.step}` : "step unknown",
    };
  });
}

function replayCandidate(history: HistoryEntry[]): HistoryEntry | null {
  return (
    history.find((entry) => entry.stage === "drafted") ??
    history.find((entry) => entry.stage === "prepared") ??
    history[1] ??
    history[0] ??
    null
  );
}

function buildComparison(original: JsonRecord | null, replay: JsonRecord | null): ComparisonRow[] {
  if (!original || !replay) return [];
  const keys = Array.from(new Set([...Object.keys(original), ...Object.keys(replay)])).sort();
  return keys.map((key) => {
    const originalText = formatValue(original[key]);
    const replayText = formatValue(replay[key]);
    let status: ComparisonRow["status"] = "same";
    if (!(key in original)) status = "added in replay";
    else if (!(key in replay)) status = "removed in replay";
    else if (originalText !== replayText) status = "changed";
    return { key, original: originalText, replay: replayText, status };
  });
}

export function TimeTravelReplayExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [topic, setTopic] = useState(defaultTopic);
  const [replayTopic, setReplayTopic] = useState(defaultReplayTopic);
  const [replayInstruction, setReplayInstruction] = useState(defaultReplayInstruction);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState("");
  const [originalState, setOriginalState] = useState<JsonRecord | null>(null);
  const [replayState, setReplayState] = useState<JsonRecord | null>(null);
  const [replaySourceCheckpointId, setReplaySourceCheckpointId] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);
  const selectedCheckpoint = history.find((entry) => entry.id === selectedCheckpointId) ?? null;
  const comparisonRows = buildComparison(originalState, replayState);
  const changedRows = comparisonRows.filter((row) => row.status !== "same");

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setHistory([]);
    setSelectedCheckpointId("");
    setOriginalState(null);
    setReplayState(null);
    setReplaySourceCheckpointId("");
    setEvents([]);
    setError("");
  }

  async function refreshHistory(activeThreadId: string, preferredCheckpointId?: string) {
    const historyPage = await client.threads.getHistory(activeThreadId, { limit: 30 });
    const normalized = normalizeHistory(historyPage);
    setHistory(normalized);
    const preferred = preferredCheckpointId
      ? normalized.find((entry) => entry.id === preferredCheckpointId)
      : replayCandidate(normalized);
    setSelectedCheckpointId(preferred?.id ?? normalized[0]?.id ?? "");
    return normalized;
  }

  async function runOriginal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setHistory([]);
    setSelectedCheckpointId("");
    setOriginalState(null);
    setReplayState(null);
    setReplaySourceCheckpointId("");
    setStatus("Creating original thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "08-time-travel-replay-ui", flow: "original", topic: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming original run");

      const stream = await client.runs.stream(nextThreadId, "time_travel_replay", {
        input: {
          topic: trimmed,
          replay_instruction: "Create the original baseline before any replay branch.",
          run_label: "original",
          source_checkpoint_id: "initial",
        },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
        setStatus(`Original stream: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      setOriginalState(valuesOf(state));
      const normalized = await refreshHistory(nextThreadId);
      setSelectedCheckpointId(replayCandidate(normalized)?.id ?? normalized[0]?.id ?? "");
      setStatus("Original complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Original failed");
    } finally {
      setBusy(false);
    }
  }

  async function runReplay() {
    if (!threadId || !selectedCheckpoint) return;
    const trimmedTopic = replayTopic.trim();
    const trimmedInstruction = replayInstruction.trim();
    if (!trimmedTopic || !trimmedInstruction) return;

    setBusy(true);
    setError("");
    setReplayState(null);
    setReplaySourceCheckpointId(selectedCheckpoint.id);
    setStatus("Replaying from selected checkpoint");

    try {
      const stream = await client.runs.stream(threadId, "time_travel_replay", {
        input: {
          topic: trimmedTopic,
          replay_instruction: trimmedInstruction,
          run_label: "fork",
          source_checkpoint_id: selectedCheckpoint.id,
        },
        checkpointId: selectedCheckpoint.id,
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
        setStatus(`Replay stream: ${logEntry.event}`);
      }

      const replay = await client.threads.getState(threadId);
      setReplayState(valuesOf(replay));
      await refreshHistory(threadId, selectedCheckpoint.id);
      setStatus("Replay complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Replay failed");
    } finally {
      setBusy(false);
    }
  }

  const originalResult = String(originalState?.final ?? "");
  const replayResult = String(replayState?.final ?? "");

  return (
    <section className="replay-layout">
      <aside className="replay-control">
        <div className="panel-title">
          <GitBranch aria-hidden="true" size={18} />
          Replay Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <form onSubmit={runOriginal} className="run-form">
          <label className="field">
            <span>Original Topic</span>
            <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={3} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !topic.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run original timeline
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
          disabled={busy || !threadId || !selectedCheckpoint || !replayTopic.trim()}
        >
          {busy ? <Loader2 className="spin" size={16} /> : <GitBranch size={16} />}
          Replay from selected checkpoint
        </button>
        <div className="replay-source">
          <span>Selected checkpoint</span>
          <code>{selectedCheckpoint?.id ?? "none"}</code>
          <span>Replay source</span>
          <code>{replaySourceCheckpointId || "not replayed yet"}</code>
        </div>
      </div>

      <div className="checkpoint-history-panel" role="region" aria-label="Checkpoint History">
        <div className="panel-title">
          <History aria-hidden="true" size={18} />
          Checkpoint History
        </div>
        {history.length === 0 ? (
          <p className="muted">Run the original timeline to load replay checkpoints.</p>
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
                <strong>{index === 0 ? "Current head" : entry.stage}</strong>
                <code>{entry.id}</code>
                <small>{entry.step}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="state-panel replay-selected" role="region" aria-label="Selected Checkpoint">
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

      <div className="replay-result-grid">
        <div className="result-panel" role="region" aria-label="Original Result">
          <div className="panel-title">Original Result</div>
          <div className="answer-box">{originalResult || "No original result yet."}</div>
        </div>
        <div className="result-panel" role="region" aria-label="Replay Result">
          <div className="panel-title">Replay Result</div>
          <div className="answer-box">{replayResult || "No replay result yet."}</div>
        </div>
      </div>

      <div className="diff-panel" role="region" aria-label="Replay Comparison">
        <div className="panel-title">
          <GitCompareArrows aria-hidden="true" size={18} />
          Replay Comparison
        </div>
        {comparisonRows.length === 0 ? (
          <p className="muted">Run a replay branch to compare original and replay state values.</p>
        ) : (
          <>
            <p className="comparison-summary">
              Replay fork changed {changedRows.length} state fields from checkpoint{" "}
              <code>{replaySourceCheckpointId}</code>.
            </p>
            <div className="diff-table">
              <div className="diff-heading">
                <span>Key</span>
                <span>Status</span>
                <span>Original Value</span>
                <span>Replay Value</span>
              </div>
              {comparisonRows.map((row) => (
                <div key={row.key} className={`diff-row ${row.status.replaceAll(" ", "-")}`}>
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
