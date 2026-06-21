import { Calculator, Loader2, MessageSquarePlus, RotateCcw, Send, Wrench } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { langGraphApiUrl, StreamLogEntry, createClientId } from "../../lib/langgraphClient";

type ChatItem = {
  id: string;
  role: "human" | "assistant";
  content: string;
};

type ToolStatus = "running" | "success" | "error";

type ToolCard = {
  id: string;
  name: string;
  args?: unknown;
  status: ToolStatus;
  result?: string;
  error?: string;
};

type StreamMessage = Record<string, unknown>;

type ToolCallingState = {
  messages?: StreamMessage[];
};

const samplePrompts = [
  "Use the calculator tool to multiply 12 by 7, then explain the result.",
  "Look up the LangGraph term ToolNode and summarize it.",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item) && typeof item.text === "string") return item.text;
        if (isRecord(item) && typeof item.content === "string") return item.content;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function extractMessages(value: unknown): StreamMessage[] {
  if (Array.isArray(value)) return value.flatMap(extractMessages);
  if (!isRecord(value)) return [];

  const maybeType = value.type ?? value.role;
  if (typeof maybeType === "string" && ("content" in value || "tool_calls" in value)) {
    return [value];
  }

  const messages = value.messages;
  if (Array.isArray(messages)) return messages.flatMap(extractMessages);

  return Object.values(value).flatMap(extractMessages);
}

function toolCallsFromMessage(message: StreamMessage): StreamMessage[] {
  if (Array.isArray(message.tool_calls)) return message.tool_calls as StreamMessage[];

  const additional = message.additional_kwargs;
  if (isRecord(additional) && Array.isArray(additional.tool_calls)) {
    return additional.tool_calls as StreamMessage[];
  }

  return [];
}

function toolCallIdOf(call: StreamMessage, fallback: string): string {
  return String(call.id ?? call.tool_call_id ?? fallback);
}

function toolNameOf(call: StreamMessage): string {
  if (typeof call.name === "string") return call.name;
  if (isRecord(call.function) && typeof call.function.name === "string") {
    return call.function.name;
  }
  return "tool";
}

function toolArgsOf(call: StreamMessage): unknown {
  if ("args" in call) return call.args;
  if (isRecord(call.function) && typeof call.function.arguments === "string") {
    try {
      return JSON.parse(call.function.arguments);
    } catch {
      return call.function.arguments;
    }
  }
  return {};
}

function upsertToolCall(cards: ToolCard[], next: ToolCard): ToolCard[] {
  const index = cards.findIndex((card) => card.id === next.id);
  if (index < 0) return [next, ...cards];
  return cards.map((card) => (card.id === next.id ? { ...card, ...next } : card));
}

function latestToolCard(cards: ToolCard[], toolCallId: string): ToolCard | undefined {
  return cards.find((card) => card.id === toolCallId) ?? cards[0];
}

function projectMessages(messages: StreamMessage[] = []): ChatItem[] {
  return messages.flatMap<ChatItem>((message, index) => {
    const type = String(message.type ?? message.role ?? "").toLowerCase();
    const text = contentToText(message.content);
    if (!text || type.includes("tool")) return [];
    if (type.includes("human") || type === "user") {
      return [{ id: String(message.id ?? `human-${index}`), role: "human", content: text }];
    }
    if (type.includes("ai") || type === "assistant") {
      return [{ id: String(message.id ?? `assistant-${index}`), role: "assistant", content: text }];
    }
    return [];
  });
}

function projectToolCards(messages: StreamMessage[] = []): ToolCard[] {
  return messages.reduce<ToolCard[]>((cards, message, index) => {
    const type = String(message.type ?? message.role ?? "").toLowerCase();
    const calls = toolCallsFromMessage(message);
    let nextCards = cards;

    if (calls.length > 0) {
      nextCards = calls.reduce((next, call, callIndex) => {
        const id = toolCallIdOf(call, `tool-${index}-${callIndex}`);
        return upsertToolCall(next, {
          id,
          name: toolNameOf(call),
          args: toolArgsOf(call),
          status: "running",
        });
      }, nextCards);
    }

    if (type.includes("tool")) {
      const toolCallId = String(message.tool_call_id ?? message.id ?? "");
      const result = contentToText(message.content) || JSON.stringify(message.content ?? "");
      const existing = latestToolCard(nextCards, toolCallId);
      nextCards = upsertToolCall(nextCards, {
        id: toolCallId || existing?.id || `tool-result-${index}`,
        name: String(message.name ?? existing?.name ?? "tool"),
        args: existing?.args,
        status: result.toLowerCase().startsWith("error") ? "error" : "success",
        result,
        error: result.toLowerCase().startsWith("error") ? result : undefined,
      });
    }

    return nextCards;
  }, []);
}

export function ToolCallingReactHookExample() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(samplePrompts[0]);
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);

  function addEvent(event: string, data: unknown, runId?: string) {
    setEvents((current) =>
      [
        {
          id: createClientId("stream"),
          event,
          runId,
          data,
          receivedAt: new Date().toLocaleTimeString(),
        },
        ...current,
      ].slice(0, 80),
    );
  }

  const stream = useStream<ToolCallingState>({
    apiUrl: langGraphApiUrl,
    assistantId: "05_tool_calling_react",
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

  const streamMessages = useMemo(
    () => extractMessages(stream.values.messages),
    [stream.values.messages],
  );
  const messages = useMemo(() => projectMessages(streamMessages), [streamMessages]);
  const toolCards = useMemo(() => projectToolCards(streamMessages), [streamMessages]);
  const busy = stream.isLoading;

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setEvents([]);
    setStatus("Submitting with useStream");
    await stream.submit(
      { messages: [{ type: "human", content: trimmed }] },
      { streamMode: ["updates"] },
    );
  }

  function resetView() {
    stream.switchThread(null);
    setThreadId(null);
    setEvents([]);
    setStatus("Idle");
  }

  return (
    <section className="tool-layout">
      <aside className="tool-control">
        <div className="panel-title">
          <Wrench aria-hidden="true" size={18} />
          Tool Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>

        <div className="sample-list" aria-label="Sample prompts">
          {samplePrompts.map((sample) => (
            <button
              key={sample}
              type="button"
              className="sample-button"
              onClick={() => setPrompt(sample)}
              disabled={busy}
            >
              {sample}
            </button>
          ))}
        </div>

        <form onSubmit={sendMessage} className="run-form">
          <label className="field">
            <span>Prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
              Run with useStream
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
            <strong>{busy ? "Streaming" : status}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "auto-created"}</strong>
          </div>
          <div>
            <span>SDK surface</span>
            <strong>useStream</strong>
          </div>
        </div>
        {stream.error ? <p className="error-line">{String(stream.error)}</p> : null}
      </aside>

      <div className="tool-chat-panel">
        <div className="panel-title">
          <MessageSquarePlus aria-hidden="true" size={18} />
          ReAct Messages
        </div>
        <div className="message-list tool-messages" aria-label="Tool calling messages">
          {messages.length === 0 ? (
            <p className="muted">Run the calculator prompt to see assistant and tool steps.</p>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={`message-bubble ${message.role === "human" ? "human" : "ai"}`}>
                <span>{message.role}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="tool-card-panel" role="region" aria-label="Tool Calls">
        <div className="panel-title">
          <Calculator aria-hidden="true" size={18} />
          Tool Calls
        </div>
        <div className="tool-card-list">
          {toolCards.length === 0 ? (
            <p className="muted">No tool calls yet.</p>
          ) : (
            toolCards.map((card) => (
              <article
                key={card.id}
                className={`tool-card ${card.status}`}
                aria-label={`Tool call ${card.name}`}
              >
                <div className="tool-card-header">
                  <div>
                    <strong>{card.name}</strong>
                    <code>{card.id}</code>
                  </div>
                  <span className="tool-status">{card.status}</span>
                </div>
                <div className="tool-card-grid">
                  <div>
                    <span>Arguments</span>
                    <pre>{JSON.stringify(card.args ?? {}, null, 2)}</pre>
                  </div>
                  <div>
                    <span>{card.status === "error" ? "Error" : "Result"}</span>
                    <pre>{card.error ?? card.result ?? "Waiting for tool result"}</pre>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
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
