import { Loader2, MessageSquarePlus, RefreshCw, Send } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { StreamEventsPanel } from "./ResultsPanels";
import { useBasicChatReactHook } from "./useBasicChatReactHook";

export function BasicChatReactHookExample() {
  const {
    conversations,
    threadId,
    input,
    setInput,
    status,
    events,
    stream,
    messages,
    busy,
    startConversation,
    selectConversation,
    sendMessage,
  } = useBasicChatReactHook();
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
            onClick={startConversation}
            disabled={busy}
          >
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
            <p className="muted">
              Send a message to let useStream create a thread.
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
            placeholder="Type a message for the same hook-managed thread"
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

        {stream.error ? (
          <p className="error-line">{String(stream.error)}</p>
        ) : null}
      </div>

      <StreamEventsPanel events={events} />
    </section>
  );
}
