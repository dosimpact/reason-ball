import { GitMerge, Loader2, Play, RotateCcw, Workflow } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


const samples = [
  {
    label: "Analyze Launch",
    value:
      "Evaluate a product launch plan for a LangGraph SDK learning workspace and combine market, customer, and operations findings.",
  },
  {
    label: "Market Compare",
    value:
      "Compare market positioning, developer adoption, and support readiness for a new agent dashboard.",
  },
  {
    label: "Support Summary",
    value:
      "Summarize support, documentation, and onboarding risks before a developer preview release.",
  },
];

type JsonRecord = Record<string, unknown>;
type WorkerStatus = "pending" | "running" | "done" | "completed" | "failed";

type WorkerCard = {
  id: string;
  index: number;
  label: string;
  item: string;
  status: WorkerStatus;
  detail: string;
  result: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeStatus(value: unknown): WorkerStatus {
  if (value === "running" || value === "done" || value === "completed" || value === "failed") {
    return value;
  }
  return "pending";
}

function workerFromRecord(record: JsonRecord, fallbackIndex: number): WorkerCard {
  const id = typeof record.id === "string" ? record.id : String(record.worker_id ?? `worker-${fallbackIndex + 1}`);
  const index = typeof record.index === "number" ? record.index : fallbackIndex;
  return {
    id,
    index,
    label: typeof record.label === "string" ? record.label : `Worker ${index + 1}`,
    item: typeof record.item === "string" ? record.item : id,
    status: normalizeStatus(record.status),
    detail: typeof record.detail === "string" ? record.detail : "",
    result: typeof record.result === "string" ? record.result : "",
  };
}

function mergeWorkers(current: WorkerCard[], updates: WorkerCard[]) {
  const byId = new Map(current.map((worker) => [worker.id, worker]));
  for (const update of updates) {
    const existing = byId.get(update.id);
    byId.set(update.id, {
      ...existing,
      ...update,
      detail: update.detail || existing?.detail || "",
      result: update.result || existing?.result || "",
    });
  }
  return Array.from(byId.values()).sort((left, right) => left.index - right.index);
}

function workersFromArray(value: unknown): WorkerCard[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((record, index) => workerFromRecord(record, index));
}

function updateWorkerEvent(current: WorkerCard[], event: JsonRecord) {
  const workerId = typeof event.worker_id === "string" ? event.worker_id : "";
  if (!workerId || workerId === "dispatcher") return current;
  const index = typeof event.index === "number" ? event.index : current.length;
  return mergeWorkers(current, [
    {
      id: workerId,
      index,
      label: `Worker ${workerId}`,
      item: typeof event.detail === "string" ? event.detail : workerId,
      status: normalizeStatus(event.status),
      detail: typeof event.detail === "string" ? event.detail : "",
      result: "",
    },
  ]);
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

export function ParallelMapReduceExample() {
  const [topic, setTopic] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [workers, setWorkers] = useState<WorkerCard[]>([]);
  const [reducerInputs, setReducerInputs] = useState<WorkerCard[]>([]);
  const [reducerOutput, setReducerOutput] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setWorkers([]);
    setReducerInputs([]);
    setReducerOutput("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (Array.isArray(values.worker_statuses)) {
      setWorkers((current) => mergeWorkers(current, workersFromArray(values.worker_statuses)));
    }
    if (Array.isArray(values.worker_results)) {
      const resultWorkers = workersFromArray(values.worker_results).map((worker) => ({
        ...worker,
        status: worker.status === "pending" ? "done" : worker.status,
        detail: worker.detail || "Partial result ready for reducer.",
      }));
      setWorkers((current) => mergeWorkers(current, resultWorkers));
    }
    if (Array.isArray(values.reducer_inputs)) {
      setReducerInputs(workersFromArray(values.reducer_inputs));
    }
    if (typeof values.reducer_output === "string") {
      setReducerOutput(values.reducer_output);
    }
    if (Object.keys(values).length > 0) {
      setFinalState(values);
    }
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || typeof data.worker_id !== "string") return;
    setWorkers((current) => updateWorkerEvent(current, data));
  }

  async function runMapReduce(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setWorkers([]);
    setReducerInputs([]);
    setReducerOutput("");
    setFinalState(null);
    setStatus("Creating map-reduce thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "11-parallel-map-reduce-ui", topic: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming parallel workers");

      const stream = await client.runs.stream(nextThreadId, "11_parallel_map_reduce", {
        input: { topic: trimmed },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 120));
        if (logEntry.event === "custom") {
          applyCustomEvent(logEntry.data);
        }
        for (const payload of nodePayloads(logEntry.data)) {
          applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      applyValues(values);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

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
        <form onSubmit={runMapReduce} className="run-form">
          <label className="field">
            <span>Topic</span>
            <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !topic.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run map-reduce
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
            <span>Workers</span>
            <strong>{workers.length}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className="worker-progress-panel" role="region" aria-label="Worker Progress">
        <div className="panel-title">Worker Progress</div>
        <div className="worker-card-grid">
          {workers.length === 0 ? (
            <p className="muted">Run a topic to see parallel worker progress.</p>
          ) : (
            workers.map((worker) => (
              <article
                key={worker.id}
                className={`worker-card ${worker.status}`}
                data-worker-id={worker.id}
              >
                <div className="worker-card-header">
                  <strong>{worker.label}</strong>
                  <span>{worker.status === "done" ? "completed" : worker.status}</span>
                </div>
                <code>worker_id: {worker.id}</code>
                <p className="worker-item">Item {worker.index + 1}: {worker.item}</p>
                <p>
                  <strong>{worker.result ? "Partial result:" : "Progress:"}</strong>{" "}
                  {worker.result || worker.detail || "Waiting for partial result."}
                </p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="reducer-input-panel" role="region" aria-label="Reducer Inputs">
        <div className="panel-title">
          <GitMerge aria-hidden="true" size={18} />
          Reducer Inputs
        </div>
        {reducerInputs.length === 0 ? (
          <p className="muted">No reducer inputs yet.</p>
        ) : (
          <ol className="reducer-input-list">
            {reducerInputs.map((input) => (
              <li key={input.id} className="reducer-input" data-worker-id={input.id}>
                <strong>{input.label}</strong>
                <span>{input.status}</span>
                <p>{input.result}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="result-panel reducer-output-panel" role="region" aria-label="Reducer Output">
        <div className="panel-title">Reducer Output</div>
        <div className="answer-box">
          {reducerOutput ? `Final combined output: ${reducerOutput}` : "No reducer output yet."}
        </div>
      </div>

      <div className="state-panel parallel-final-state" role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
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
