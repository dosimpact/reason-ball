import { CheckCircle2, Loader2, MessageSquare, RotateCcw, Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  ChatMessageRecord, StreamLogEntry, createClientId, createLangGraphClient,
  langGraphApiUrl, normalizeMessage, normalizeStreamChunk,
} from "../../lib/langgraphClient";

type JsonRecord = Record<string, unknown>;
const thinkingStatusPropsSchema = z.object({
  title: z.string(),
  stage: z.number().int().min(0),
  total: z.number().int().positive(),
  status: z.enum(["running", "completed", "failed"]),
  summary: z.string(),
  dummy: z.boolean(),
});
export type ThinkingStatusProps = z.infer<typeof thinkingStatusPropsSchema>;
export type ThinkingStatusUpdate = Partial<ThinkingStatusProps>;
type UIMessageMetadata = JsonRecord & {
  message_id?: string;
  schema_version?: string;
  ordinal?: number;
  merge?: boolean;
};
type UIMessageEnvelope = {
  id: string;
  metadata: UIMessageMetadata;
};
export type ThinkingStatusMessage = UIMessageEnvelope & {
  type: "ui";
  name: "thinking_status";
  props: ThinkingStatusProps;
};
export type ThinkingStatusUpdateMessage = UIMessageEnvelope & {
  type: "ui";
  name: "thinking_status";
  props: ThinkingStatusUpdate;
  metadata: UIMessageMetadata & { merge: true };
};
type UnsupportedUIMessage = UIMessageEnvelope & {
  type: "unsupported-ui";
  name: string;
  props: JsonRecord;
};
// React state contains complete, typed components; stream patches are separate.
type UIMessage = ThinkingStatusMessage | UnsupportedUIMessage;
type UIMessageEvent = UIMessageEnvelope & {
  type: "ui" | "remove-ui";
  name: string;
  props: JsonRecord;
};
type TurnMessage = ChatMessageRecord & { turnStatus?: string };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeChatMessages(value: unknown): TurnMessage[] {
  const list = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.messages) ? value.messages : [];
  return list.flatMap((raw): TurnMessage[] => {
    if (!isRecord(raw)) return [];
    const message = normalizeMessage(raw);
    const extra = isRecord(raw.additional_kwargs) ? raw.additional_kwargs : {};
    if (message) return [{ ...message, turnStatus: message.role === "ai" ? "completed" : undefined }];
    if ((raw.type === "ai" || raw.role === "assistant") && typeof raw.id === "string" && raw.content === "") {
      return [{ id: raw.id, role: "ai", content: "", turnStatus: String(extra.turn_status ?? "running") }];
    }
    return [];
  });
}

function normalizeUi(value: unknown): UIMessageEvent | null {
  if (!isRecord(value) || (value.type !== "ui" && value.type !== "remove-ui") || typeof value.id !== "string") return null;
  const props = isRecord(value.props) ? value.props : {};
  const rawMetadata = isRecord(value.metadata) ? value.metadata : {};
  if (value.type === "ui" && value.name === "thinking_status") {
    // merge=True events contain only the fields that changed.
    const schema = rawMetadata.merge === true ? thinkingStatusPropsSchema.partial() : thinkingStatusPropsSchema;
    if (!schema.safeParse(props).success) return null;
  }
  return {
    type: value.type, id: value.id, name: String(value.name ?? "unknown"),
    props,
    metadata: {
      ...rawMetadata,
      message_id: typeof rawMetadata.message_id === "string" ? rawMetadata.message_id : undefined,
      schema_version: typeof rawMetadata.schema_version === "string" ? rawMetadata.schema_version : undefined,
      ordinal: typeof rawMetadata.ordinal === "number" ? rawMetadata.ordinal : undefined,
      merge: rawMetadata.merge === true,
    },
  };
}

function mergeUi(current: UIMessage[], incoming: UIMessageEvent[]): UIMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    if (message.type === "remove-ui") { messages.delete(message.id); continue; }
    const previous = messages.get(message.id);
    const props = message.metadata.merge === true ? { ...previous?.props, ...message.props } : message.props;
    const metadata = { ...previous?.metadata, ...message.metadata };
    const parsed = thinkingStatusPropsSchema.safeParse(props);
    if (message.name === "thinking_status" && parsed.success) {
      messages.set(message.id, {
        type: "ui", id: message.id, name: "thinking_status", props: parsed.data, metadata,
      });
    } else {
      messages.set(message.id, {
        type: "unsupported-ui", id: message.id, name: message.name, props, metadata,
      });
    }
  }
  return [...messages.values()];
}

function ProgressMessage({ message }: { message: UIMessage }) {
  if (message.type === "unsupported-ui") {
    return <li className="push-ui-progress-item"><pre>{JSON.stringify(message, null, 2)}</pre></li>;
  }
  const running = message.props.status === "running";
  return (
    <li className="push-ui-progress-item" data-ui-message-id={message.id}>
      {running ? <Loader2 className="spin" size={14} aria-hidden="true" /> :
        message.props.status === "completed" ? <CheckCircle2 size={14} aria-hidden="true" /> : <span aria-hidden="true">•</span>}
      <div>
        <strong>{message.props.title}</strong>
        <span className="push-ui-progress-status">{message.props.stage > 0 ? `${message.props.stage}/${message.props.total} · ` : ""}
          {running ? "진행중" : message.props.status === "completed" ? "완료" : "중단"}</span>
        <span className="push-ui-progress-summary"> — {message.props.summary}</span>
      </div>
    </li>
  );
}

export function PushUiMessageExample() {
  const client = useMemo(() => createLangGraphClient(), []);
  const [input, setInput] = useState("LangGraph의 push_ui_message를 간단히 설명해줘.");
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState<TurnMessage[]>([]);
  const [uiMessages, setUiMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, uiMessages]);

  function applyValues(values: JsonRecord) {
    if (Array.isArray(values.messages)) {
      const incoming = normalizeChatMessages(values.messages);
      setMessages((current) => [...new Map([...current, ...incoming].map((message) => [message.id, message])).values()]);
    }
    if (Array.isArray(values.ui)) {
      const incoming = values.ui.map(normalizeUi).filter((message): message is UIMessageEvent => message !== null);
      setUiMessages((current) => mergeUi(current, incoming));
    }
    if (typeof values.final_status === "string") setStatus(values.final_status);
    if (typeof values.error === "string" && values.error) setError(values.error);
  }

  function resetChat() {
    setThreadId(""); setMessages([]); setUiMessages([]);
    setEvents([]); setFinalState(null); setError(""); setStatus("idle");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy) return;
    const human: ChatMessageRecord = { id: createClientId("user"), role: "human", content: prompt };
    let activeAssistantId = "";
    setBusy(true); setError(""); setStatus("running"); setInput("");
    setEvents([]); setFinalState(null);
    setMessages((current) => [...current, human]);
    try {
      let activeThread = threadId;
      if (!activeThread) {
        const thread = await client.threads.create({ metadata: { example: "25-push-ui-message" } });
        activeThread = String(thread.thread_id);
        setThreadId(activeThread);
      }
      const stream = await client.runs.stream(activeThread, "25_push_ui_message_example", {
        input: { messages: [{ id: human.id, role: "user", content: prompt }] },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });
      for await (const chunk of stream) {
        const entry = normalizeStreamChunk(chunk);
        setEvents((current) => [entry, ...current].slice(0, 160));
        if (entry.event === "error") throw new Error(JSON.stringify(entry.data));
        if (entry.event === "custom") {
          const message = normalizeUi(entry.data);
          if (message) setUiMessages((current) => mergeUi(current, [message]));
        } else if (entry.event === "updates" && isRecord(entry.data)) {
          for (const value of Object.values(entry.data)) {
            if (!isRecord(value)) continue;
            if (typeof value.assistant_message_id === "string") activeAssistantId = value.assistant_message_id;
            applyValues(value);
          }
        }
      }
      const state = await client.threads.getState(activeThread);
      const values = isRecord(state) && isRecord(state.values) ? state.values : {};
      applyValues(values);
      setMessages(normalizeChatMessages(values));
      setFinalState(values);
      if (values.final_status !== "completed") throw new Error(String(values.error || "최종 응답이 완료되지 않았습니다."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("failed");
      setInput(prompt);
      setMessages((current) => current.map((message) => message.id === activeAssistantId && !message.content
        ? { ...message, turnStatus: "failed" } : message));
      setUiMessages((current) => current.map((message) => message.type === "ui" && message.props.status === "running"
        ? { ...message, props: { ...message.props, status: "failed" } } : message));
    } finally { setBusy(false); }
  }

  function progressFor(messageId: string) {
    return uiMessages.filter((message) => message.metadata.message_id === messageId)
      .sort((a, b) => Number(a.metadata.ordinal) - Number(b.metadata.ordinal))
      .map((message) => <ProgressMessage key={message.id} message={message} />);
  }

  return (
    <section className="push-ui-layout push-ui-chat-layout">
      <aside className="push-ui-control">
        <div className="panel-title"><MessageSquare size={18} /> Push UI Chat</div>
        <label className="field"><span>LangGraph API URL</span><input value={langGraphApiUrl} readOnly /></label>
        <button type="button" className="secondary-button" onClick={resetChat} disabled={busy}>
          <RotateCcw size={16} /> New chat
        </button>
        <p>한 응답 안에서 작업 착수 → 단계별 진행 → 최종 답변이 이어집니다.</p>
        <p className="muted">3단계는 더미 자료를 처리하는 LLM 호출입니다.</p>
        <div className="runtime-facts"><div><span>Status</span><strong>{status}</strong></div>
          <div><span>Thread ID</span><strong>{threadId || "none"}</strong></div></div>
      </aside>
      <div className="inline-ui-chat-panel" role="region" aria-label="Chat">
        <div className="panel-title">Chat</div>
        <div ref={messageListRef} className="push-chat-stack" role="log" aria-label="Messages" aria-live="polite">
          {messages.length === 0 ? <p className="muted">메시지를 보내 대화를 시작하세요.</p> : null}
          {messages.map((message) => (
            <article key={message.id} data-chat-message-id={message.id}
              className={`push-chat-bubble ${message.role === "human" ? "human" : "assistant"}`}>
              <strong>{message.role === "human" ? "User" : "Assistant"}</strong>
              {message.role === "ai" ? (
                <details className="push-ui-progress-details">
                  <summary>작업 과정</summary>
                  <ul className="push-ui-progress-list" aria-label="작업 진행 과정">{progressFor(message.id)}</ul>
                </details>
              ) : null}
              {message.content ? <>
                {message.role === "ai" ? <strong>최종 응답</strong> : null}
                <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>
              </> : <p className="muted">{message.turnStatus === "failed" ? "응답이 중단되었습니다." :
                uiMessages.some((ui) => ui.metadata.message_id === message.id && ui.props.stage === 3 && ui.props.status === "completed")
                  ? "최종 응답 작성중…" : "작업 진행중…"}</p>}
            </article>
          ))}
        </div>
        <form className="chat-input-row" onSubmit={sendMessage}>
          <input aria-label="Message" value={input} onChange={(event) => setInput(event.target.value)} placeholder="메시지를 입력하세요" disabled={busy} />
          <button type="submit" className="primary-button" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />} Send
          </button>
        </form>
        {error ? <p className="error-line" role="alert">{error}</p> : null}
      </div>
      <details className="event-panel push-ui-chat-debug">
        <summary>실행 상태와 스트림 상세</summary>
        <div role="region" aria-label="Final State"><div className="panel-title">Final State</div>
          <pre>{finalState ? JSON.stringify(finalState, null, 2) : "No final state yet."}</pre></div>
        <div role="region" aria-label="Raw Stream Events"><div className="panel-title">Raw Stream Events</div>
          {events.map((entry) => <details key={entry.id} className="event-row"><summary>{entry.event}</summary>
            <pre>{JSON.stringify(entry.data, null, 2)}</pre></details>)}</div>
      </details>
    </section>
  );
}
