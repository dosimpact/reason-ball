import { Loader2, MessageSquare, RotateCcw, Send } from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { usePushUiChat } from "./usePushUiChat";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { RunDiagnostics } from "./RunDiagnostics";
import { progressForMessage } from "./uiMessages";

export type { ThinkingStatusProps, ThinkingStatusUpdate, ThinkingStatusMessage } from "./uiMessages";

export function PushUiMessageExample() {
  const {
    input, setInput,
    threadId, messages, uiMessages,
    status, busy, error,
    events, finalState,
    sendMessage, resetChat,
  } = usePushUiChat();

  return (
    <section className="push-ui-layout push-ui-chat-layout">
      <aside className="push-ui-control">
        <div className="panel-title">
          <MessageSquare size={18} /> Push UI Chat
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <button type="button" className="secondary-button" onClick={resetChat} disabled={busy}>
          <RotateCcw size={16} /> New chat
        </button>
        <p>한 응답 안에서 작업 착수 → 단계별 진행 → 최종 답변이 이어집니다.</p>
        <p className="muted">3단계는 더미 자료를 처리하는 LLM 호출입니다.</p>
        <div className="runtime-facts">
          <div><span>Status</span><strong>{status}</strong></div>
          <div><span>Thread ID</span><strong>{threadId || "none"}</strong></div>
        </div>
      </aside>

      <div className="inline-ui-chat-panel" role="region" aria-label="Chat">
        <div className="panel-title">Chat</div>
        <div
          className="push-chat-stack"
          role="log"
          aria-label="Messages"
          aria-live="polite"
        >
          {messages.length === 0 && <p className="muted">메시지를 보내 대화를 시작하세요.</p>}
          {messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              progress={progressForMessage(uiMessages, message.id)}
            />
          ))}
        </div>
        <form className="chat-input-row" onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}>
          <input
            aria-label="Message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="메시지를 입력하세요"
            disabled={busy}
          />
          <button type="submit" className="primary-button" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />} Send
          </button>
        </form>
        {error && <p className="error-line" role="alert">{error}</p>}
      </div>

      <RunDiagnostics events={events} finalState={finalState} />
    </section>
  );
}
