import { getCharacter, getMission, uuidSchema } from "@/shared/api/supabase/domain";
import { assertDatabaseSuccess, createPrivilegedClient, createRequestClient, createRequestId, jsonSuccessResponse, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId();
  try {
    const parsed = uuidSchema.safeParse((await context.params).id);
    if (!parsed.success) throw new SupabaseHttpError(400, "INVALID_CONVERSATION_ID", "The conversation id is invalid.");
    const id = parsed.data;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const result = await client.from("conversations")
      .select("id, character_id, character_version_id, mission_id, mission_version_id")
      .eq("id", id).eq("owner_id", user.id).eq("status", "active").limit(1);
    assertDatabaseSuccess(result.error, "conversations.context_owner");
    const row = result.data?.[0];
    if (!row) throw new SupabaseHttpError(404, "CONVERSATION_NOT_FOUND", "The active conversation could not be found.");
    const admin = createPrivilegedClient();
    const [character, mission] = await Promise.all([
      getCharacter(admin, row.character_id, row.character_version_id),
      row.mission_id ? getMission(admin, row.mission_id, row.mission_version_id) : null,
    ]);
    if (!character || (row.mission_id && !mission)) throw new SupabaseHttpError(409, "CHAT_CONTEXT_UNAVAILABLE", "The saved conversation context is unavailable.");
    // Avatar/reward assets are not version snapshots; do not substitute a later
    // image or expose private asset paths through privileged hydration.
    const savedCharacter = { ...character };
    delete savedCharacter.imageUrl;
    const savedMission = mission ? { ...mission, rewardImageUrl: undefined } : undefined;
    const aliases = await admin.from("characters").select("slug").eq("id", row.character_id).limit(1);
    assertDatabaseSuccess(aliases.error, "characters.context_alias");
    const missionAlias = row.mission_id ? await admin.from("missions").select("slug").eq("id", row.mission_id).limit(1) : undefined;
    if (missionAlias) assertDatabaseSuccess(missionAlias.error, "missions.context_alias");
    return jsonSuccessResponse(requestId, {
      context: { conversationId: row.id, character: savedCharacter, mission: savedMission,
        characterAliases: [row.character_id, aliases.data?.[0]?.slug].filter(Boolean),
        missionAliases: row.mission_id ? [row.mission_id, missionAlias?.data?.[0]?.slug].filter(Boolean) : [] },
    });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
