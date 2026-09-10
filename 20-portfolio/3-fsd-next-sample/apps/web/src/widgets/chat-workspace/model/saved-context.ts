import type { ChatLearningContext } from "@/entities/chat/model/types";

export function validateSavedChatContext(
  context: ChatLearningContext,
  route: { conversationId: string; characterId: string; missionId?: string },
) {
  if (!context || context.conversationId !== route.conversationId || !context.character?.id ||
    !Array.isArray(context.characterAliases) || !context.characterAliases.includes(route.characterId) ||
    !context.characterAliases.includes(context.character.id) ||
    !Array.isArray(context.missionAliases) ||
    (context.mission ? !context.missionAliases.includes(context.mission.id) : context.missionAliases.length > 0) ||
    (route.missionId && (!context.mission || !context.missionAliases.includes(route.missionId)))) {
    throw new Error("저장된 대화와 요청한 캐릭터·미션이 일치하지 않아요.");
  }
  return context;
}
