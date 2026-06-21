import { Loader2, MessageSquarePlus, RefreshCw, Send, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  defaultLangGraphApiUrl,
  ChatMessageRecord,
  StreamLogEntry,
  createClientId,
  createLangGraphClient,
  extractLatestMessageText,
  normalizeMessages,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultApiUrl = defaultLangGraphApiUrl();

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
};

export function BasicChatExample() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("My project code is cobalt.");
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => createLangGraphClient(apiUrl), [apiUrl]);

  async function createConversation(title = "New conversation") {
    setBusy(true);
    setError("");
    setStatus("Creating conversation");
    try {
      const thread = await client.threads.create({
        metadata: { example: "02-basic-chat-ui", title },
      });
      const threadRecord = thread as { thread_id?: string; threadId?: string; id?: string };
      const nextThreadId = threadRecord.thread_id ?? threadRecord.threadId ?? threadRecord.id;
      if (!nextThreadId) throw new Error("Thread creation did not return a thread id.");
      const conversation: Conversation = {
        id: String(nextThreadId),
        title,
        createdAt: new Date().toLocaleTimeString(),
      };
      setConversations((current) => [conversation, ...current]);
      setThreadId(conversation.id);
      setMessages([]);
      setEvents([]);
      setStatus("Conversation ready");
      return conversation.id;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Conversation create failed");
      return "";
    } finally {
      setBusy(false);
    }
  }

  async function selectConversation(id: string) {
    setThreadId(id);
    setError("");
    setStatus("Loading conversation state");
    try {
      const state = await client.threads.getState(id);
      setMessages(normalizeMessages(state));
      setStatus("Conversation loaded");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Conversation load failed");
    }
  }

  async function deleteConversation() {
    if (!threadId) return;
    setBusy(true);
    setError("");
    setStatus("Deleting conversation");
    try {
      await client.threads.delete(threadId);
      setConversations((current) => current.filter((conversation) => conversation.id !== threadId));
      setThreadId("");
      setMessages([]);
      setEvents([]);
      setStatus("Conversation deleted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Conversation delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setInput("");
    setStatus("Sending message");
    setEvents([]);

    const activeThreadId = threadId || (await createConversation("Memory check"));
    if (!activeThreadId) {
      setBusy(false);
      return;
    }

    const humanMessage: ChatMessageRecord = {
      id: createClientId("message"),
      role: "human",
      content: trimmed,
    };
    const assistantDraftId = createClientId("message");
    setMessages((current) => [
      ...current,
      humanMessage,
      { id: assistantDraftId, role: "ai", content: "Streaming..." },
    ]);

    try {
      const stream = await client.runs.stream(activeThreadId, "basic_chat", {
        input: { messages: [{ type: "human", content: trimmed }] },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 40));
        const text = extractLatestMessageText(logEntry.data);
        if (text) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantDraftId ? { ...message, content: text } : message,
            ),
          );
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(activeThreadId);
      setMessages(normalizeMessages(state));
      setStatus("Run complete");
    } catch (caught) {
      setMessages((current) => current.filter((message) => message.id !== assistantDraftId));
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat-layout">
      <aside className="conversation-panel">
        <div className="panel-title">Conversations</div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void createConversation()}
            disabled={busy}
          >
            <MessageSquarePlus size={16} />
            New chat
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => threadId && void selectConversation(threadId)}
            disabled={!threadId || busy}
          >
            <RefreshCw size={16} />
            Reload state
          </button>
          <button type="button" className="icon-button danger" onClick={deleteConversation} disabled={!threadId || busy}>
            <Trash2 size={16} />
          </button>
        </div>

        <div className="conversation-list">
          {conversations.length === 0 ? (
            <p className="muted">Create a chat or send a message to start a thread.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={conversation.id === threadId ? "conversation-item active" : "conversation-item"}
                onClick={() => void selectConversation(conversation.id)}
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
            <strong>{status}</strong>
          </div>
          <div>
            <span>Thread</span>
            <strong>{threadId || "none"}</strong>
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
            placeholder="Type a message for the same LangGraph thread"
          />
          <button type="submit" className="primary-button" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
            Send
          </button>
        </form>

        {error ? <p className="error-line">{error}</p> : null}
      </div>

      <div className="event-panel">
        <div className="panel-title">Thread stream events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No events for this run yet.</p>
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
