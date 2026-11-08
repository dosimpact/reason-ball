import type { useChatPlanBoard } from "./useChatPlanBoard";

type Props = Pick<
  ReturnType<typeof useChatPlanBoard>,
  | "userGoal"
  | "planSummary"
  | "final"
>;

export function ChatTranscript({
  userGoal,
  planSummary,
  final,
}: Props) {
  return (
    <div className="plan-board-chat-panel" role="region" aria-label="Chat Transcript">
      <div className="panel-title">Chat Transcript</div>
      <article className="plan-board-chat-message user">
        <strong>User</strong>
        <p>{userGoal}</p>
      </article>
      <article className="plan-board-chat-message assistant">
        <strong>Assistant</strong>
        <p>{planSummary || final || "No plan board yet."}</p>
      </article>
    </div>
  );
}
