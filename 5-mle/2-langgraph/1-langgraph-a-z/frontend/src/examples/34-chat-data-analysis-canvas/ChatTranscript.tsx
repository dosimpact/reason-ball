import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "userRequest"
  | "insightSummary"
  | "final"
>;

export function ChatTranscript({
  userRequest,
  insightSummary,
  final,
}: Props) {
  return (
    <div className="data-chat-panel" role="region" aria-label="Chat Transcript">
      <div className="panel-title">Chat Transcript</div>
      <article className="data-chat-message user">
        <strong>User</strong>
        <p>{userRequest}</p>
      </article>
      <article className="data-chat-message assistant">
        <strong>Assistant</strong>
        <p>{insightSummary || final || "No data analysis yet."}</p>
      </article>
    </div>
  );
}
