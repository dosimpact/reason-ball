import type { ChatMessage } from "@/entities/chat";

type RetryPlan =
  | { kind: "restore"; messages: ChatMessage[] }
  | { kind: "send"; history: ChatMessage[]; userMessage: ChatMessage };

export function planChatRetry(
  stored: readonly ChatMessage[],
  visible: readonly ChatMessage[],
  pendingUserId?: string,
): RetryPlan {
  const targetId = pendingUserId ?? visible.findLast((message) => message.role === "user")?.id;
  if (!targetId) return { kind: "restore", messages: [...stored] };
  const userIndex = stored.findIndex((message) => message.role === "user" && message.id === targetId);
  if (userIndex >= 0) {
    const after = stored.slice(userIndex + 1);
    const nextUserIndex = after.findIndex((message) => message.role === "user");
    const turnReplies = nextUserIndex < 0 ? after : after.slice(0, nextUserIndex);
    if (turnReplies.some((message) => message.role === "assistant")) return { kind: "restore", messages: [...stored] };
    if (nextUserIndex >= 0) {
      throw new Error("다른 메시지가 이미 추가됐어요. 대화를 새로 불러온 뒤 계속해 주세요.");
    }
    return { kind: "send", history: stored.slice(0, userIndex), userMessage: stored[userIndex] };
  }
  const unsaved = visible.find((message) => message.role === "user" && message.id === targetId);
  if (!unsaved) throw new Error("재전송할 메시지를 찾지 못했어요. 대화를 새로 불러와 주세요.");
  return { kind: "send", history: [...stored], userMessage: unsaved };
}
