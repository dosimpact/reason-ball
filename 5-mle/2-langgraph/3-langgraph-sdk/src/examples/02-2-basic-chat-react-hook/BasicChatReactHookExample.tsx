import { Loader2, MessageSquarePlus, RefreshCw, Send } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  ChatMessageRecord,
  StreamLogEntry,
  createClientId,
  langGraphApiUrl,
  normalizeMessages,
} from "../../lib/langgraphClient";

type BasicChatState = {
  messages?: Array<{
    id?: string;
    type?: string;
    role?: string;
    content?: unknown;
  }>;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
};

export function BasicChatReactHookExample() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("My project code is cobalt.");
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
      ].slice(0, 40),
    );
  }

  function rememberThread(nextThreadId: string) {
    setThreadId(nextThreadId);
    setConversations((current) => {
      if (current.some((conversation) => conversation.id === nextThreadId)) return current;
      return [
        {
          id: nextThreadId,
          title: current.length === 0 ? "Memory check" : "New conversation",
          createdAt: new Date().toLocaleTimeString(),
        },
        ...current,
      ];
    });
  }

  const stream = useStream<BasicChatState>({
    apiUrl: langGraphApiUrl,
    assistantId: "02_basic_chat",
    threadId,
    onThreadId: rememberThread,
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

  const messages = useMemo<ChatMessageRecord[]>(
    () => normalizeMessages({ values: stream.values }),
    [stream.values],
  );
  const busy = stream.isLoading;

  function startConversation() {
    stream.switchThread(null);
    setThreadId(null);
    setEvents([]);
    setStatus("New conversation ready");
  }

  function selectConversation(id: string) {
    stream.switchThread(id);
    setThreadId(id);
    setEvents([]);
    setStatus("Conversation selected");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setInput("");
    setEvents([]);
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

  return (
    <section className="chat-layout">
      <aside className="conversation-panel">
        <div className="panel-title">Conversations</div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={startConversation} disabled={busy}>
            <MessageSquarePlus size={16} />
            New chat
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => threadId && selectConversation(threadId)}
            disabled={!threadId || busy}
          >
            <RefreshCw size={16} />
            Reload hook state
          </button>
        </div>

        <div className="conversation-list">
          {conversations.length === 0 ? (
            <p className="muted">Send a message to let useStream create a thread.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={conversation.id === threadId ? "conversation-item active" : "conversation-item"}
                onClick={() => selectConversation(conversation.id)}
              >
                <strong>{conversation.title}</strong>
                <span>{conversation.createdAt}</span>
                <code>{conversation.id}</code>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="chat-panel">
        <div className="chat-status">
          <div>
            <span>Status</span>
            <strong>{busy ? "Streaming" : status}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "auto-created"}</strong>
          </div>
        </div>

        <div className="message-list" aria-label="Messages">
          {messages.length === 0 ? (
            <p className="muted">Try: "My project code is cobalt." Then ask what the code is.</p>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={`message-bubble ${message.role}`}>
                <span>{message.role}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>

        <form className="chat-input-row" onSubmit={sendMessage}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message for the same hook-managed thread"
          />
          <button type="submit" className="primary-button" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
            Send
          </button>
        </form>

        {stream.error ? <p className="error-line">{String(stream.error)}</p> : null}
      </div>

      <div className="event-panel">
        <div className="panel-title">Hook callback events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No callback events for this run yet.</p>
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
