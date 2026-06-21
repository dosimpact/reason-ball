import { Activity, Loader2, Play, RotateCcw, Waves } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createClientId,
  extractLatestMessageText,
} from "../../lib/langgraphClient";

type StreamMode = "messages" | "updates" | "values" | "custom";

type StreamingState = {
  prompt?: string;
  progress?: ProgressEvent[];
  messages?: Array<{
    id?: string;
    type?: string;
    role?: string;
    content?: unknown;
  }>;
  final?: string;
};

type ProgressEvent = {
  node?: string;
  phase?: string;
  progress?: number;
  detail?: string;
};

const streamModes: Array<{ mode: StreamMode; label: string }> = [
  { mode: "messages", label: "messages" },
  { mode: "updates", label: "updates" },
  { mode: "values", label: "values" },
  { mode: "custom", label: "custom" },
];

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          if (typeof record.text === "string") return record.text;
          if (typeof record.content === "string") return record.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function latestMessageText(messages: StreamingState["messages"]): string {
  const latest = [...(messages ?? [])]
    .reverse()
    .find((message) => message.type === "ai" || message.role === "assistant");
  return textFromContent(latest?.content);
}

function coerceProgressEvent(data: unknown): ProgressEvent {
  if (!data || typeof data !== "object") return { detail: String(data ?? "") };
  const record = data as Record<string, unknown>;
  return {
    node: typeof record.node === "string" ? record.node : undefined,
    phase: typeof record.phase === "string" ? record.phase : undefined,
    progress: typeof record.progress === "number" ? record.progress : undefined,
    detail: typeof record.detail === "string" ? record.detail : String(record.msg ?? ""),
  };
}

export function StreamingReactHookExample() {
  const [mode, setMode] = useState<StreamMode>("messages");
  const [prompt, setPrompt] = useState("Explain how LangGraph streaming helps a React UI.");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState("Idle");
  const [runId, setRunId] = useState("");
  const [updates, setUpdates] = useState<unknown[]>([]);
  const [values, setValues] = useState<unknown[]>([]);
  const [customEvents, setCustomEvents] = useState<ProgressEvent[]>([]);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const valueSnapshotRef = useRef("");

  const addEvent = useCallback((event: string, data: unknown, nextRunId?: string) => {
    setEvents((current) =>
      [
        {
          id: createClientId("stream"),
          event,
          runId: nextRunId,
          data,
          receivedAt: new Date().toLocaleTimeString(),
        },
        ...current,
      ].slice(0, 80),
    );
    if (nextRunId) setRunId(nextRunId);
  }, []);

  const stream = useStream<StreamingState>({
    apiUrl: langGraphApiUrl,
    assistantId: "04_streaming_ui",
    threadId,
    onThreadId: setThreadId,
    onCreated(run) {
      setStatus("Run created");
      addEvent("created", run, run.run_id);
    },
    onMetadataEvent(data) {
      addEvent("metadata", data, data.run_id);
    },
    onUpdateEvent(data) {
      setStatus("Streaming: updates");
      setUpdates((current) => [data, ...current].slice(0, 20));
      addEvent("updates", data);
    },
    onCustomEvent(data) {
      setStatus("Streaming: custom");
      setCustomEvents((current) => [coerceProgressEvent(data), ...current].slice(0, 20));
      addEvent("custom", data);
    },
    onFinish(state, run) {
      const stateValues = state.values ?? state;
      setStatus("Run complete");
      setValues((current) => [stateValues, ...current].slice(0, 20));
      addEvent("finish", stateValues, run?.run_id);
    },
    onError(error, run) {
      setStatus("Run failed");
      addEvent("error", error, run?.run_id);
    },
  });

  useEffect(() => {
    const snapshot = JSON.stringify(stream.values);
    if (mode !== "values" || snapshot === valueSnapshotRef.current) return;
    valueSnapshotRef.current = snapshot;
    setValues((current) => [stream.values, ...current].slice(0, 20));
    addEvent("values", stream.values);
  }, [addEvent, mode, stream.values]);

  const tokenText =
    latestMessageText(stream.values.messages) ||
    latestMessageText(stream.messages as StreamingState["messages"]) ||
    extractLatestMessageText(stream.values) ||
    "";

  async function runStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setRunId("");
    setUpdates([]);
    setValues([]);
    setCustomEvents([]);
    setEvents([]);
    valueSnapshotRef.current = "";
    setStatus(`Submitting ${mode} stream with useStream`);

    await stream.submit(
      { prompt: trimmed, progress: [] },
      {
        streamMode: [mode],
      },
    );
  }

  function resetView() {
    stream.switchThread(null);
    setThreadId(null);
    setRunId("");
    setUpdates([]);
    setValues([]);
    setCustomEvents([]);
    setEvents([]);
    valueSnapshotRef.current = "";
    setStatus("Idle");
  }

  return (
    <section className="streaming-layout">
      <div className="stream-control">
        <div className="panel-title">
          <Waves aria-hidden="true" size={18} />
          React Hook Stream Controls
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>

        <div className="mode-toggle" aria-label="Stream mode">
          {streamModes.map((item) => (
            <button
              key={item.mode}
              type="button"
              className={item.mode === mode ? "mode-button active" : "mode-button"}
              aria-pressed={item.mode === mode}
              onClick={() => setMode(item.mode)}
              disabled={stream.isLoading}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={runStream} className="run-form">
          <label className="field">
            <span>Prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={stream.isLoading || !prompt.trim()}>
              {stream.isLoading ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run with useStream
            </button>
            <button type="button" className="secondary-button" onClick={resetView} disabled={stream.isLoading}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>

        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{stream.isLoading ? "Streaming" : status}</strong>
          </div>
          <div>
            <span>Mode</span>
            <strong>{mode}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "auto-created"}</strong>
          </div>
          <div>
            <span>Run</span>
            <strong>{runId || "pending"}</strong>
          </div>
        </div>
        {stream.error ? <p className="error-line">{String(stream.error)}</p> : null}
      </div>

      <div className="mode-panel-grid">
        <section className="stream-panel token-panel">
          <div className="panel-title">Token / Message Output</div>
          <div className="answer-box">{tokenText || "Run messages mode to see hook-managed text."}</div>
        </section>

        <section className="stream-panel">
          <div className="panel-title">State Updates</div>
          <div className="event-list compact">
            {updates.length === 0 ? (
              <p className="muted">No update payloads yet.</p>
            ) : (
              updates.map((update, index) => (
                <pre key={index} className="payload-box">
                  {JSON.stringify(update, null, 2)}
                </pre>
              ))
            )}
          </div>
        </section>

        <section className="stream-panel">
          <div className="panel-title">Values Snapshots</div>
          <div className="event-list compact">
            {values.length === 0 ? (
              <p className="muted">No hook values snapshots yet.</p>
            ) : (
              values.map((value, index) => (
                <pre key={index} className="payload-box">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ))
            )}
          </div>
        </section>

        <section className="stream-panel">
          <div className="panel-title">
            <Activity aria-hidden="true" size={18} />
            Custom Progress Events
          </div>
          <div className="progress-list">
            {customEvents.length === 0 ? (
              <p className="muted">No custom progress events yet.</p>
            ) : (
              customEvents.map((item, index) => (
                <article key={index} className="progress-card">
                  <div>
                    <strong>{item.node ?? "custom"}</strong>
                    <span>{item.phase ?? "event"}</span>
                  </div>
                  <meter min="0" max="1" value={item.progress ?? 0} />
                  <p>{item.detail}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="state-panel">
        <div className="panel-title">Hook Values</div>
        <pre>{JSON.stringify(stream.values, null, 2)}</pre>
      </div>

      <div className="event-panel">
        <div className="panel-title">Hook Callback Events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No callback events yet.</p>
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
