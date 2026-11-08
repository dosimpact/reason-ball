import {
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { StreamEventsPanel } from "./ResultsPanels";
import { useBasicChat } from "./useBasicChat";

export function BasicChatExample() {
  const {
    conversations,
    threadId,
    messages,
    input,
    setInput,
    status,
    events,
    error,
    busy,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
  } = useBasicChat();
  return (
    <section className="chat-layout">
      <aside className="conversation-panel">
        <div className="panel-title">Conversations</div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
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
          <button
            type="button"
            className="icon-button danger"
            onClick={deleteConversation}
            disabled={!threadId || busy}
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="conversation-list">
          {conversations.length === 0 ? (
            <p className="muted">
              Create a chat or send a message to start a thread.
            </p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={
                  conversation.id === threadId
                    ? "conversation-item active"
                    : "conversation-item"
                }
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
            <p className="muted">
              Try: "My project code is cobalt." Then ask what the code is.
            </p>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`message-bubble ${message.role}`}
              >
                <span>{message.role}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>

        <form
          className="chat-input-row"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message for the same LangGraph thread"
          />
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !input.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
            Send
          </button>
        </form>

        {error ? <p className="error-line">{error}</p> : null}
      </div>

      <StreamEventsPanel events={events} />
    </section>
  );
}
