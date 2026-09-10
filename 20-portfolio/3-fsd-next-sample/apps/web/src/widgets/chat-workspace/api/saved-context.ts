import { mockChatRepository, usesRemoteChatData } from "@/entities/chat";
import type { ChatLearningContext } from "@/entities/chat/model/types";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { getLearningRepository } from "@/shared/api/learning";
import { validateSavedChatContext } from "../model/saved-context";

export async function loadSavedChatContext(route: { conversationId: string; characterId: string; missionId?: string }) {
  if (usesRemoteChatData()) {
    await ensureBrowserSession();
    const response = await fetch(`/api/conversations/${encodeURIComponent(route.conversationId)}/context`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? "저장된 대화 설정을 불러오지 못했어요.");
    return validateSavedChatContext(body.context as ChatLearningContext, route);
  }
  const conversation = mockChatRepository.getConversation(route.conversationId);
  if (!conversation) throw new Error("저장된 대화를 찾을 수 없어요.");
  const repository = getLearningRepository();
  const character = conversation.learningContext?.character ?? await repository.getCharacter(conversation.characterId);
  const mission = conversation.learningContext
    ? conversation.learningContext.mission
    : conversation.missionId ? await repository.getMission(conversation.missionId) : undefined;
  if (!character || character.id !== conversation.characterId ||
    (mission?.id ?? undefined) !== conversation.missionId) {
    throw new Error("저장된 대화의 학습 설정을 복원할 수 없어요.");
  }
  return validateSavedChatContext({ conversationId: conversation.id, character, mission: mission ?? undefined,
    characterAliases: [character.id], missionAliases: mission ? [mission.id] : [] }, route);
}
