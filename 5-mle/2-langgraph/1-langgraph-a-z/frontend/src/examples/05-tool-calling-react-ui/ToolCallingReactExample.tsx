import {
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  Send,
  Wrench,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samplePrompts } from "./data";
import { StreamEventsPanel, ToolCallsView } from "./ResultsPanels";
import { useToolCallingReact } from "./useToolCallingReact";

export function ToolCallingReactExample() {
  const {
    threadId,
    prompt,
    setPrompt,
    messages,
    toolCards,
    status,
    events,
    error,
    busy,
    resetView,
    sendMessage,
  } = useToolCallingReact();
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

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
          className="run-form"
        >
          <label className="field">
            <span>Prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
            />
          </label>
          <div className="button-row">
            <button
              type="submit"
              className="primary-button"
              disabled={busy || !prompt.trim()}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              Run tool call
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetView}
              disabled={busy}
            >
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
        <div
          className="message-list tool-messages"
          aria-label="Tool calling messages"
        >
          {messages.length === 0 ? (
            <p className="muted">
              Run the calculator prompt to see assistant and tool steps.
            </p>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`message-bubble ${message.role === "human" ? "human" : "ai"}`}
              >
                <span>{message.role}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <ToolCallsView toolCards={toolCards} status={status} error={error} />

      <StreamEventsPanel events={events} />
    </section>
  );
}
