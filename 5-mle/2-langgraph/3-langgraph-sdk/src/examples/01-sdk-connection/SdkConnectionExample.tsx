import { Loader2, Play, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  AssistantRecord,
  StreamLogEntry,
  assistantIdOf,
  assistantLabelOf,
  createLangGraphClient,
  defaultLangGraphApiUrl,
  extractLatestMessageText,
  normalizeAssistants,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

export function SdkConnectionExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [assistants, setAssistants] = useState<AssistantRecord[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState("sdk_connection");
  const [threadId, setThreadId] = useState("");
  const [prompt, setPrompt] = useState("Say hello from the SDK connection example.");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [answer, setAnswer] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);

  async function loadAssistants() {
    setBusy(true);
    setError("");
    setStatus("Loading assistants");
    try {
      const result = await (client.assistants as any).search({ limit: 100 });
      const normalized = normalizeAssistants(result);
      setAssistants(normalized);
      const preferred =
        normalized.find(
          (assistant) =>
            assistant.graph_id === "sdk_connection" ||
            assistant.graphId === "sdk_connection" ||
            assistant.name === "sdk_connection",
        ) ?? normalized[0];
      if (preferred) {
        setSelectedAssistantId(preferred.graph_id ?? preferred.graphId ?? assistantIdOf(preferred));
      }
      setStatus(`Loaded ${normalized.length} assistant${normalized.length === 1 ? "" : "s"}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Assistant load failed");
    } finally {
      setBusy(false);
    }
  }

  async function createThread() {
    setBusy(true);
    setError("");
    setStatus("Creating thread");
    try {
      const thread = await (client.threads as any).create();
      const nextThreadId = thread.thread_id ?? thread.threadId ?? thread.id;
      setThreadId(nextThreadId);
      setEvents([]);
      setAnswer("");
      setRunId("");
      setStatus("Thread ready");
      return nextThreadId as string;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Thread create failed");
      return "";
    } finally {
      setBusy(false);
    }
  }

  async function deleteThread() {
    if (!threadId) return;
    setBusy(true);
    setError("");
    setStatus("Deleting thread");
    try {
      await (client.threads as any).delete(threadId);
      setThreadId("");
      setRunId("");
      setEvents([]);
      setAnswer("");
      setStatus("Thread deleted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Thread delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setAnswer("");
    setRunId("");
    setEvents([]);
    setStatus("Starting run");

    try {
      const activeThreadId = threadId || (await createThread());
      if (!activeThreadId) throw new Error("Unable to create or reuse a thread.");

      const stream = await (client.runs as any).stream(activeThreadId, selectedAssistantId, {
        input: {
          messages: [{ type: "human", content: prompt }],
        },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        if (logEntry.runId) setRunId(logEntry.runId);

        const text = extractLatestMessageText(logEntry.data);
        if (text) setAnswer(text);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="example-grid">
      <div className="control-panel">
        <div className="panel-title">
          <Server aria-hidden="true" size={18} />
          Runtime
        </div>

        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>

        <div className="button-row">
          <button type="button" className="secondary-button" onClick={loadAssistants} disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            Load assistants
          </button>
          <button type="button" className="secondary-button" onClick={createThread} disabled={busy}>
            <Plus size={16} />
            New thread
          </button>
          <button type="button" className="icon-button danger" onClick={deleteThread} disabled={busy || !threadId}>
            <Trash2 size={16} />
          </button>
        </div>

        <label className="field">
          <span>Assistant</span>
          <select
            value={selectedAssistantId}
            onChange={(event) => setSelectedAssistantId(event.target.value)}
          >
            <option value="sdk_connection">sdk_connection</option>
            {assistants.map((assistant) => {
              const id = assistantIdOf(assistant);
              return (
                <option key={id} value={id}>
                  {assistantLabelOf(assistant)}
                </option>
              );
            })}
          </select>
        </label>

        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>Run</span>
            <strong>{runId || "pending"}</strong>
          </div>
        </div>

        <form onSubmit={runAssistant} className="run-form">
          <label className="field">
            <span>Input</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
          </label>
          <button type="submit" className="primary-button" disabled={busy || !selectedAssistantId}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run and stream
          </button>
        </form>

        {error ? <p className="error-line">{error}</p> : null}
      </div>

      <div className="result-panel">
        <div className="panel-title">OpenAI-backed response</div>
        <div className="answer-box">{answer || "Run the assistant to stream a response."}</div>
      </div>

      <div className="event-panel">
        <div className="panel-title">Stream events</div>
        <div className="event-list">
          {events.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            events.map((entry) => (
              <details key={entry.id} className="event-row">
                <summary>
                  <span>{entry.receivedAt}</span>
                  <strong>{entry.event}</strong>
                  {entry.runId ? <code>{entry.runId}</code> : null}
                </summary>
                <pre>{JSON.stringify(entry.data, null, 2)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
