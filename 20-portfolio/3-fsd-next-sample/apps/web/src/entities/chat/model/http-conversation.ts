import type { ChatConversation, ChatMessage, ChatVote, CreateConversationInput } from "./types";
import { hasToolApprovalResponse } from "./tool-approval";

export type ConversationResponseItem = {
  id: string;
  characterId: string;
  missionId: string | null;
  missionRunId?: string;
  title: string;
  status: "active" | "archived" | "deleted";
  modelId: string;
  createdAt: string;
  updatedAt: string;
};

export type MessageResponseItem = {
  id: string;
  clientMessageId?: string | null;
  role: string;
  status: string;
  parts: ChatMessage["parts"];
  sequenceNumber: number;
  createdAt: string;
  vote?: { rating: -1 | 1; reason: string | null } | null;
};

export function voteFromHttp(value: unknown): ChatVote {
  if (!value || typeof value !== "object" || !("rating" in value)
    || (value.rating !== 1 && value.rating !== -1)
    || !("reason" in value) || (value.reason !== null && typeof value.reason !== "string")) {
    throw new Error("저장된 피드백을 읽지 못했어요.");
  }
  return { value: value.rating === 1 ? "up" : "down", ...(value.reason ? { reason: value.reason } : {}) };
}

export function storedMessagesToChat(rows: readonly MessageResponseItem[]): ChatMessage[] {
  return rows.flatMap((row) => {
    if (row.role !== "user" && row.role !== "assistant") return [];
    const checkpoint = row === rows.at(-1) && row.role === "assistant"
      && ["pending", "error", "cancelled"].includes(row.status)
      && hasToolApprovalResponse({ id: row.id, role: "assistant", parts: row.parts });
    if (row.status !== "complete" && !checkpoint) return [];
    return [{
      id: row.role === "user" ? row.clientMessageId ?? row.id : row.id,
      role: row.role,
      parts: row.parts,
      metadata: { databaseId: row.id },
    } as ChatMessage];
  });
}

export function conversationFromHttp(
  item: ConversationResponseItem,
  rows: readonly MessageResponseItem[],
  context: CreateConversationInput,
): ChatConversation {
  if (item.characterId !== context.characterId || (item.missionId ?? undefined) !== context.missionId) {
    throw new Error("요청한 캐릭터·미션과 저장된 대화가 일치하지 않아요.");
  }
  if (item.status !== "active") throw new Error("보관되거나 삭제된 대화예요. 대화 기록에서 상태를 확인해 주세요.");
  const messages = storedMessagesToChat(rows);
  const latest = messages.at(-1);
  return {
    ...context,
    id: item.id,
    title: item.title,
    modelId: item.modelId,
    missionRunId: item.missionRunId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    messages,
    draft: "",
    theme: "light",
    artifacts: [],
    votes: Object.fromEntries(rows
      .filter((row) => row.role === "assistant" && row.status === "complete" && row.vote != null)
      .map((row) => [row.id, voteFromHttp(row.vote)])),
    ...(latest?.role === "user" ? {
      pendingRequest: { userMessageId: latest.id, startedAt: item.updatedAt },
    } : {}),
  };
}
