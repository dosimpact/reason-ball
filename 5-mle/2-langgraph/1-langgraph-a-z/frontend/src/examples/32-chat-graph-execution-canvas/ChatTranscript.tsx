import type { useChatGraphExecutionCanvas } from "./useChatGraphExecutionCanvas";

type Props = Pick<
  ReturnType<typeof useChatGraphExecutionCanvas>,
  | "userPrompt"
  | "chatSummary"
  | "final"
>;

export function ChatTranscript({
  userPrompt,
  chatSummary,
  final,
}: Props) {
  return (
    <div className="graph-canvas-chat-panel" role="region" aria-label="Chat Transcript">
      <div className="panel-title">Chat Transcript</div>
      <article className="graph-canvas-chat-message user">
        <strong>User</strong>
        <p>{userPrompt}</p>
      </article>
      <article className="graph-canvas-chat-message assistant">
        <strong>Assistant</strong>
        <p>{chatSummary || final || "No graph canvas yet."}</p>
      </article>
    </div>
  );
}
