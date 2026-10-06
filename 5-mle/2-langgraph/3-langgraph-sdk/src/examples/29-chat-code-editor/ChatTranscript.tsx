import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "userRequest"
  | "proposalSummary"
  | "final"
>;

export function ChatTranscript({
  userRequest,
  proposalSummary,
  final,
}: Props) {
  return (
    <div className="code-chat-panel" role="region" aria-label="Chat Transcript">
      <div className="panel-title">Chat Transcript</div>
      <div className="code-chat-message user">
        <strong>User</strong>
        <p>{userRequest}</p>
      </div>
      <div className="code-chat-message assistant">
        <strong>Assistant</strong>
        <p>{proposalSummary || final || "No code proposal yet."}</p>
      </div>
    </div>
  );
}
