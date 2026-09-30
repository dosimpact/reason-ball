import "server-only";

import {
  assertDatabaseSuccess,
  createPrivilegedClient,
  createRequestClient,
  requireAuthenticatedUser,
  SupabaseHttpError,
} from "./http";
import { loadPublishedCharacterRuntime, loadPublishedMissionRuntime } from "./runtime";

type ConversationSnapshot = {
  id: string;
  character_id: string;
  character_version_id: string;
  mission_id: string | null;
  mission_version_id: string | null;
};

async function loadOwnedConversation(conversationId: string) {
  const client = await createRequestClient();
  const user = await requireAuthenticatedUser(client);
  const result = await client
    .from("conversations")
    .select("id, character_id, character_version_id, mission_id, mission_version_id")
    .eq("id", conversationId)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .limit(1);
  assertDatabaseSuccess(result.error, "conversations.chat_context");
  const conversation = (result.data ?? [])[0] as ConversationSnapshot | undefined;
  if (!conversation) {
    throw new SupabaseHttpError(404, "CONVERSATION_NOT_FOUND", "The active conversation could not be found.");
  }
  return { userId: user.id, conversation };
}

export async function loadAuthorizedChatContext(conversationId: string) {
  // Privileged reads are allowed only after the request user's ownership check.
  const { userId, conversation } = await loadOwnedConversation(conversationId);
  const admin = createPrivilegedClient();
  const [character, mission] = await Promise.all([
    loadPublishedCharacterRuntime(admin, {
      characterId: conversation.character_id,
      characterVersionId: conversation.character_version_id,
      allowArchived: true,
    }),
    conversation.mission_id && conversation.mission_version_id
      ? loadPublishedMissionRuntime(admin, {
          missionId: conversation.mission_id,
          missionVersionId: conversation.mission_version_id,
          allowArchived: true,
        })
      : undefined,
  ]);
  return {
    userId,
    snapshots: {
      character: { version: character.version, instructions: character.instructions },
      ...(mission ? { mission: { version: mission.version, instructions: mission.instructions, steps: mission.steps } } : {}),
    },
  };
}
