import { MessageSquareText } from "lucide-react";

import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "userRequest"
  | "revisionSummary"
  | "final"
>;

export function ChatTranscript({
  userRequest,
  revisionSummary,
  final,
}: Props) {
  return (
    <div className="document-chat-panel" role="region" aria-label="Chat Transcript">
      <div className="panel-title">
        <MessageSquareText aria-hidden="true" size={16} />
        Chat Transcript
      </div>
      <article className="document-chat-message user">
        <strong>User</strong>
        <p>{userRequest}</p>
      </article>
      <article className="document-chat-message assistant">
        <strong>Assistant</strong>
        <p>{revisionSummary || final || "No document proposal yet."}</p>
      </article>
    </div>
  );
}
