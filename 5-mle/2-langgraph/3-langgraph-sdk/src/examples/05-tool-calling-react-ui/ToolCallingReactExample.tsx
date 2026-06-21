import { Calculator, Loader2, MessageSquarePlus, RotateCcw, Send, Wrench } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createClientId,
  createLangGraphClient,
  extractLatestMessageText,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";


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
type MessageStreamData = StreamMessage | [StreamMessage, ...unknown[]];

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
  if (Array.isArray(message.tool_calls)) return message.tool_calls as Record<string, unknown>[];

  const additional = message.additional_kwargs;
  if (isRecord(additional) && Array.isArray(additional.tool_calls)) {
    return additional.tool_calls as Record<string, unknown>[];
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

function isMessageStreamData(value: unknown): value is MessageStreamData {
  if (isRecord(value)) return true;
  return Array.isArray(value) && value.some(isRecord);
}

function messageFromStream(data: MessageStreamData): StreamMessage | null {
  if (Array.isArray(data)) {
    const firstRecord = data.find(isRecord);
    return firstRecord ?? null;
  }
  return isRecord(data) ? data : null;
}

function upsertToolCall(cards: ToolCard[], next: ToolCard): ToolCard[] {
  const index = cards.findIndex((card) => card.id === next.id);
  if (index < 0) return [next, ...cards];
  return cards.map((card) => (card.id === next.id ? { ...card, ...next } : card));
}

function latestToolCard(cards: ToolCard[], toolCallId: string): ToolCard | undefined {
  return cards.find((card) => card.id === toolCallId) ?? cards[0];
}

export function ToolCallingReactExample() {
  const [threadId, setThreadId] = useState("");
  const [prompt, setPrompt] = useState(samplePrompts[0]);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [toolCards, setToolCards] = useState<ToolCard[]>([]);
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(), []);

  function resetView() {
    setThreadId("");
    setMessages([]);
    setToolCards([]);
    setStatus("Idle");
    setEvents([]);
    setError("");
  }

  function handleStreamMessages(streamMessages: StreamMessage[]) {
    for (const message of streamMessages) {
      const type = String(message.type ?? message.role ?? "").toLowerCase();
      const text = contentToText(message.content);

      if (type.includes("ai") || type === "assistant") {
        const calls = toolCallsFromMessage(message);
        if (calls.length > 0) {
          if (text) {
            setMessages((current) => [
              ...current,
              {
                id: String(message.id ?? createClientId("message")),
                role: "assistant",
                content: text,
              },
            ]);
          }
          setToolCards((current) =>
            calls.reduce((cards, call, index) => {
              const id = toolCallIdOf(call, `tool-${index}`);
              return upsertToolCall(cards, {
                id,
                name: toolNameOf(call),
                args: toolArgsOf(call),
                status: "running",
              });
            }, current),
          );
        }
      }

      if (type.includes("tool")) {
        
        const toolCallId = String(message.tool_call_id ?? message.id ?? "");
        const result = text || JSON.stringify(message.content ?? "");

        setToolCards((current) => {
          const existing = latestToolCard(current, toolCallId);
          return upsertToolCall(current, {
            id: toolCallId || existing?.id || createClientId("tool"),
            name: String(message.name ?? existing?.name ?? "tool"),
            args: existing?.args,
            status: result.toLowerCase().startsWith("error") ? "error" : "success",
            result,
            error: result.toLowerCase().startsWith("error") ? result : undefined,
          });
        });
      }
    }
  }

  function handleMessageStream(data: MessageStreamData) {
    const message = messageFromStream(data);
    if (!message) return;

    const type = String(message.type ?? message.role ?? "").toLowerCase();
    if (!type.includes("ai") && type !== "assistant") return;

    const text = contentToText(message.content);
    if (!text) return;

    const id = String(message.id ?? "streaming-assistant-message");
    setMessages((current) => {
      const existing = current.findIndex((item) => item.id === id);
      if (existing < 0) {
        return [...current, { id, role: "assistant", content: text }];
      }
      return current.map((item, index) =>
        index === existing ? { ...item, content: `${item.content}${text}` } : item,
      );
    });
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setMessages([{ id: createClientId("message"), role: "human", content: trimmed }]);
    setToolCards([]);
    setStatus("Creating tool thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "05-tool-calling-react-ui" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming tool run");

      const stream = await client.runs.stream(nextThreadId, "05_tool_calling_react", {
        input: { messages: [{ type: "human", content: trimmed }] },
        streamMode: ["messages", "updates"] as ["messages", "updates"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);

        setEvents((current) => [logEntry, ...current].slice(0, 80));
        if (logEntry.event === "messages" || logEntry.event.startsWith("messages/")) {
          if (isMessageStreamData(logEntry.data)) {
            handleMessageStream(logEntry.data);
          }
        }
        if (logEntry.event === "updates") {
          handleStreamMessages(extractMessages(logEntry.data));
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const finalText = extractLatestMessageText(state.values ?? state);
      if (finalText) {
        setMessages((current) => {
          const alreadyShown = current.some((item) => item.role === "assistant" && item.content === finalText);
          return alreadyShown
            ? current
            : [...current, { id: createClientId("message"), role: "assistant", content: finalText }];
        });
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
              Run tool call
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
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
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
