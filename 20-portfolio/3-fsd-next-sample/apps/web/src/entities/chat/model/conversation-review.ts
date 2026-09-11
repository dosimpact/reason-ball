import type { UIMessage } from "ai";

// Ordinary persisted learner text: this is a workflow affordance, not an authorization token.
export const conversationReviewPrompt = "Let's finish this practice and review our conversation. Summarize what I did well, useful corrections with my original words and improved alternatives, and a strategy for my next practice.";

export function isConversationReviewRequest(messages: readonly UIMessage[]): boolean {
  const latestUser = messages.findLast((message) => message.role === "user");
  if (!latestUser) return false;
  return latestUser.parts.every((part) => part.type === "text")
    && latestUser.parts.map((part) => part.type === "text" ? part.text : "").join("") === conversationReviewPrompt;
}

export function conversationReviewEvidence(messages: readonly UIMessage[]) {
  return messages.filter((message) => message.role === "user").flatMap((message) => {
    const text = message.parts.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n");
    return text.trim() && text !== conversationReviewPrompt ? [{ messageId: message.id, text }] : [];
  });
}
