import type { ChatConversation, ChatMessage } from "../model/types";
import { mockChatRepository } from "./mock-chat-repository";

export type SharedConversation = Pick<ChatConversation,
  "id" | "title" | "characterId" | "characterName" | "missionId" | "missionTitle" | "messages"
>;

type SharedConversationResponse = {
  conversation: {
    id: string;
    title: string;
    characterId: string;
    missionId?: string | null;
  };
  messages: Array<{ id: string; role: string; parts: ChatMessage["parts"] }>;
  readOnly: boolean;
};

export function usesRemoteChatData() {
  return process.env.NEXT_PUBLIC_APP_RUNTIME_MODE !== "mock"
    && process.env.NEXT_PUBLIC_DATA_PROVIDER === "supabase";
}

function sharedConversationFromResponse(payload: SharedConversationResponse): SharedConversation {
  if (!payload.readOnly) throw new Error("읽기 전용 공유 대화를 확인하지 못했어요.");
  return {
    id: payload.conversation.id,
    title: payload.conversation.title,
    characterId: payload.conversation.characterId,
    characterName: "AI 캐릭터",
    missionId: payload.conversation.missionId ?? undefined,
    missionTitle: payload.conversation.missionId ? "미션 대화" : undefined,
    messages: payload.messages.flatMap((message) =>
      message.role === "user" || message.role === "assistant"
        ? [{ id: message.id, role: message.role, parts: message.parts } as ChatMessage]
        : [],
    ),
  };
}

export async function getSharedConversation(token: string): Promise<SharedConversation | null> {
  if (!usesRemoteChatData()) return mockChatRepository.findByShareToken(token) ?? null;
  const response = await fetch(`/api/share/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("공유 대화를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return sharedConversationFromResponse(await response.json() as SharedConversationResponse);
}
