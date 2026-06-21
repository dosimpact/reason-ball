import { Loader2, Play, RotateCcw, Server } from "lucide-react";
import { FormEvent, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { langGraphApiUrl, StreamLogEntry, createClientId } from "../../lib/langgraphClient";

type SdkConnectionState = {
  messages?: Array<{
    id?: string;
    type?: string;
    role?: string;
    content?: unknown;
  }>;
  answer?: string;
  final?: string;
};

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
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
    .join("")
    .trim();
}

function latestAssistantText(messages: SdkConnectionState["messages"]): string {
  const latest = [...(messages ?? [])]
    .reverse()
    .find((message) => message.type === "ai" || message.role === "assistant");
  return contentToText(latest?.content);
}

export function SdkConnectionReactHookExample() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Say hello from the SDK connection React hook example.");
  const [status, setStatus] = useState("Idle");
  const [runId, setRunId] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);

  function addEvent(event: string, data: unknown, nextRunId?: string) {
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
  }

  const stream = useStream<SdkConnectionState>({
    apiUrl: langGraphApiUrl,
    assistantId: "sdk_connection",
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
      addEvent("updates", data);
    },
    onFinish(state, run) {
      setStatus("Run complete");
      addEvent("finish", state.values, run?.run_id);
    },
    onError(error, run) {
      setStatus("Run failed");
      addEvent("error", error, run?.run_id);
    },
  });

  const answer =
    latestAssistantText(stream.values.messages) ||
    String(stream.values.final ?? stream.values.answer ?? "");

  async function runAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setEvents([]);
    setRunId("");
    setStatus("Submitting with useStream");
    await stream.submit(
      {
        messages: [{ type: "human", content: trimmed }],
      },
      {
        streamMode: ["updates"],
      },
    );
  }

  function resetView() {
    stream.switchThread(null);
    setThreadId(null);
    setRunId("");
    setEvents([]);
    setStatus("Idle");
  }

  return (
    <section className="example-grid">
      <div className="control-panel">
        <div className="panel-title">
          <Server aria-hidden="true" size={18} />
          React Hook Runtime
        </div>

        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>

        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{stream.isLoading ? "Streaming" : status}</strong>
          </div>
          <div>
            <span>Assistant</span>
            <strong>sdk_connection</strong>
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

        <form onSubmit={runAssistant} className="run-form">
          <label className="field">
            <span>Input</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={stream.isLoading || !prompt.trim()}>
              {stream.isLoading ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Submit with useStream
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetView}
              disabled={stream.isLoading}
            >
              <RotateCcw size={16} />
              Reset thread
            </button>
          </div>
        </form>

        {stream.error ? <p className="error-line">{String(stream.error)}</p> : null}
      </div>

      <div className="result-panel">
        <div className="panel-title">Hook-managed response</div>
        <div className="answer-box">{answer}</div>
      </div>

      <div className="event-panel">
        <div className="panel-title">Hook callback events</div>
        <div className="event-list">
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

      <div className="state-panel">
        <div className="panel-title">Stream Values</div>
        <pre>{JSON.stringify(stream.values, null, 2)}</pre>
      </div>
    </section>
  );
}
