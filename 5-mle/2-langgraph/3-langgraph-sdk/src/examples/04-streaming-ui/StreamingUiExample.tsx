import { Activity, Loader2, Play, RotateCcw, Waves } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  extractLatestMessageText,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

// {"node":"call_model","phase":"model_done","progress":0.8,"detail":"OpenAI response received."}

type StreamMode = "messages" | "updates" | "values" | "custom";

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

function messageTextFromStream(data: unknown): string {
  if (Array.isArray(data) && data.length > 0) {
    const tupleText = textFromContent((data[0] as Record<string, unknown> | undefined)?.content);
    if (tupleText) return tupleText;

    const latest = data[data.length - 1];
    if (latest && typeof latest === "object") {
      return textFromContent((latest as Record<string, unknown>).content);
    }
  }

  if (data && typeof data === "object") {
    const contentText = textFromContent((data as Record<string, unknown>).content);
    if (contentText) return contentText;
  }

  return extractLatestMessageText(data) ?? "";
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

export function StreamingUiExample() {
  const [mode, setMode] = useState<StreamMode>("messages");
  const [prompt, setPrompt] = useState("Explain how LangGraph streaming helps a React UI.");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [tokenText, setTokenText] = useState("");
  const [updates, setUpdates] = useState<unknown[]>([]);
  const [values, setValues] = useState<unknown[]>([]);
  const [customEvents, setCustomEvents] = useState<ProgressEvent[]>([]);
  const [finalState, setFinalState] = useState<unknown>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);

  function resetView() {
    setStatus("Idle");
    setThreadId("");
    setTokenText("");
    setUpdates([]);
    setValues([]);
    setCustomEvents([]);
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  async function runStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setTokenText("");
    setUpdates([]);
    setValues([]);
    setCustomEvents([]);
    setFinalState(null);
    setEvents([]);
    setStatus(`Starting ${mode} stream`);

    try {
      const thread = await client.threads.create({
        metadata: { example: "04-streaming-ui", mode },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus(`Streaming ${mode}`);

      const stream = await client.runs.stream(nextThreadId, "04_streaming_ui", {
        input: { prompt: trimmed, progress: [] },
        streamMode: mode,
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 80));
        setStatus(`Streaming: ${logEntry.event}`);

        if (logEntry.event === "messages" || logEntry.event.startsWith("messages/")) {
          const text = messageTextFromStream(logEntry.data);
          if (text) {
            setTokenText((current) =>
              logEntry.event === "messages" ? `${current}${text}` : text,
            );
          }
        }

        if (logEntry.event === "updates") {
          setUpdates((current) => [logEntry.data, ...current].slice(0, 20));
        }

        if (logEntry.event === "values") {
          setValues((current) => [logEntry.data, ...current].slice(0, 20));
        }

        if (logEntry.event === "custom") {
          setCustomEvents((current) => [coerceProgressEvent(logEntry.data), ...current].slice(0, 20));
        }
      }

      const state = await client.threads.getState(nextThreadId);
      const valuesPayload = state.values ?? state;
      setFinalState(valuesPayload);
      const fallbackText = extractLatestMessageText(valuesPayload);
      if (!tokenText && fallbackText) setTokenText(fallbackText);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="streaming-layout">
      <div className="stream-control">
        <div className="panel-title">
          <Waves aria-hidden="true" size={18} />
          Stream Controls
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
              disabled={busy}
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
            <button type="submit" className="primary-button" disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run stream
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
            <span>Mode</span>
            <strong>{mode}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </div>

      <div className="mode-panel-grid">
        <section className="stream-panel token-panel">
          <div className="panel-title">Token / Message Output</div>
          <div className="answer-box">{tokenText || "Run messages mode to see streamed text."}</div>
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
              <p className="muted">No full-state snapshots yet.</p>
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
        <div className="panel-title">Final State</div>
        <pre>{finalState ? JSON.stringify(finalState, null, 2) : "No final state yet."}</pre>
      </div>

      <div className="event-panel">
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
                <pre>{JSON.stringify(entry.data, null, 2)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
