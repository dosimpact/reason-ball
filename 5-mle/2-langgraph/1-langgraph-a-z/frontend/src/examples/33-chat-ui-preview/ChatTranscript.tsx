import type { useChatUiPreview } from "./useChatUiPreview";

type Props = Pick<
  ReturnType<typeof useChatUiPreview>,
  | "userRequest"
  | "designSummary"
  | "final"
>;

export function ChatTranscript({
  userRequest,
  designSummary,
  final,
}: Props) {
  return (
    <div className="ui-preview-chat-panel" role="region" aria-label="Chat Transcript">
      <div className="panel-title">Chat Transcript</div>
      <article className="ui-preview-chat-message user">
        <strong>User</strong>
        <p>{userRequest}</p>
      </article>
      <article className="ui-preview-chat-message assistant">
        <strong>Assistant</strong>
        <p>{designSummary || final || "No UI preview yet."}</p>
      </article>
    </div>
  );
}
