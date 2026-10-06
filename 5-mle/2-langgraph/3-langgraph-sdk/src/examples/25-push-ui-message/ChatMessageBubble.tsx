import { CheckCircle2, Loader2 } from "lucide-react";
import { type ChatMessage } from "./chatMessages";
import { type ThinkingStatusProps, type UIMessage } from "./uiMessages";

// 메시지 표시: 진행 과정과 최종 답변을 같은 버블에 유지합니다.
const progressStatusLabels = {
  running: "진행중",
  completed: "완료",
  failed: "중단",
};

function ProgressStatusIcon({ status }: { status: ThinkingStatusProps["status"] }) {
  if (status === "running") {
    return <Loader2 className="spin" size={14} aria-hidden="true" />;
  }
  if (status === "completed") {
    return <CheckCircle2 size={14} aria-hidden="true" />;
  }
  return <span aria-hidden="true">•</span>;
}

function ProgressMessage({ message }: { message: UIMessage }) {
  if (message.type === "unsupported-ui" || message.name !== "thinking_status") {
    return (
      <li className="push-ui-progress-item">
        <pre>{JSON.stringify(message, null, 2)}</pre>
      </li>
    );
  }

  const { title, stage, total, status, summary } = message.props;
  const stageLabel = stage > 0 ? `${stage}/${total} · ` : "";

  return (
    <li className="push-ui-progress-item" data-ui-message-id={message.id}>
      <ProgressStatusIcon status={status} />
      <div>
        <strong>{title}</strong>
        <span className="push-ui-progress-status">
          {stageLabel}{progressStatusLabels[status]}
        </span>
        <span className="push-ui-progress-summary"> — {summary}</span>
      </div>
    </li>
  );
}

function pendingResponseLabel(message: ChatMessage, progress: UIMessage[]): string {
  if (message.status === "failed") return "응답이 중단되었습니다.";

  const stagesCompleted = progress.some(
    (item) => item.type === "ui"
      && item.name === "thinking_status"
      && item.props.stage === 3
      && item.props.status === "completed",
  );
  return stagesCompleted ? "최종 응답 작성중…" : "작업 진행중…";
}

function responseHeading(message: ChatMessage): string {
  if (message.status === "running") return "응답 작성중…";
  if (message.status === "failed") return "응답이 중단되었습니다.";
  return "최종 응답";
}

export function ChatMessageBubble({ message, progress }: { message: ChatMessage; progress: UIMessage[] }) {
  const isAssistant = message.role === "ai";
  const speaker = message.role === "human" ? "User" : "Assistant";
  const bubbleClass = message.role === "human" ? "human" : "assistant";

  return (
    <article
      data-chat-message-id={message.id}
      className={`push-chat-bubble ${bubbleClass}`}
    >
      <strong>{speaker}</strong>
      {isAssistant && (
        <details className="push-ui-progress-details">
          <summary>작업 과정</summary>
          <ul className="push-ui-progress-list" aria-label="작업 진행 과정">
            {progress.map((item) => <ProgressMessage key={item.id} message={item} />)}
          </ul>
        </details>
      )}
      {message.content ? (
        <>
          {isAssistant && (
            <strong>{responseHeading(message)}</strong>
          )}
          <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>
        </>
      ) : (
        <p className="muted">{pendingResponseLabel(message, progress)}</p>
      )}
    </article>
  );
}
