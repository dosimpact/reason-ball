import {
  conversationCreateSchema,
  conversationDto,
  requireAllowedChatModel,
} from "@/shared/api/supabase/chatbot";
import { resolveResourceSnapshot } from "@/shared/api/supabase/domain";
import { z } from "zod";
import {
  assertDatabaseSuccess,
  assertTrustedMutationRequest,
  createPrivilegedClient,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
  throwMutationError,
} from "@/shared/api/supabase/http";
import {
  loadPublishedCharacterRuntime,
  loadPublishedMissionRuntime,
} from "@/shared/api/supabase/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const conversationColumns =
  "id, character_id, character_version_id, mission_id, mission_version_id, title, visibility, status, model_id, last_message_at, created_at, updated_at";

export async function DELETE(request: Request) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(request, z.object({
      confirmation: z.literal("DELETE ALL"), requestId: z.uuid(),
    }).strict(), requestId, 1024);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const result = await createPrivilegedClient().rpc("purge_owned_conversations", {
      _expected_owner_id: user.id, _request_id: parsed.data.requestId,
    });
    if (result.error) throwMutationError(result.error, "conversations.purge_owned");
    return jsonSuccessResponse(requestId, { deleted: true, deletedCount: result.data });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

async function findCreatedConversation(
  client: Awaited<ReturnType<typeof createRequestClient>>,
  id: string,
  ownerId: string,
  creationRequest: string,
) {
  const result = await client.from("conversations")
    .select(`${conversationColumns}, share_token, metadata`)
    .eq("id", id).eq("owner_id", ownerId).limit(1);
  assertDatabaseSuccess(result.error, "conversations.creation_replay");
  const row = result.data?.[0];
  if (!row) return undefined;
  if (row.status !== "active" || row.metadata?.creationRequest !== creationRequest) {
    throw new SupabaseHttpError(409, "CONVERSATION_CREATE_CONFLICT", "This conversation ID was already used for another request.");
  }
  return row;
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
      : 50;
    let query = client
      .from("conversations")
      .select(conversationColumns)
      .eq("owner_id", user.id)
      .neq("status", "deleted")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    const before = url.searchParams.get("before");
    if (before) {
      const parsedDate = new Date(before);
      if (Number.isNaN(parsedDate.valueOf())) {
        throw new SupabaseHttpError(
          400,
          "INVALID_CURSOR",
          "The conversation cursor is invalid.",
        );
      }
      query = query.lt("created_at", parsedDate.toISOString());
    }
    const result = await query;
    assertDatabaseSuccess(result.error, "conversations.list_owned");
    return jsonSuccessResponse(requestId, {
      items: (result.data ?? []).map((row) => conversationDto(row)),
      hasMore: (result.data ?? []).length === limit,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(
      request,
      conversationCreateSchema,
      requestId,
      32 * 1024,
    );
    if (!parsed.ok) return parsed.response;

    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const creationRequest = JSON.stringify({
      characterId: parsed.data.characterId,
      missionId: parsed.data.missionId ?? null,
      title: parsed.data.title,
      titleMode: parsed.data.titleMode,
      visibility: parsed.data.visibility,
      modelId: parsed.data.modelId ?? null,
    });
    if (parsed.data.id) {
      const existing = await findCreatedConversation(client, parsed.data.id, user.id, creationRequest);
      if (existing) return jsonSuccessResponse(requestId, { item: conversationDto(existing), replayed: true });
    }
    const character = await resolveResourceSnapshot(
      client,
      "characters",
      parsed.data.characterId,
    );
    await loadPublishedCharacterRuntime(admin, {
      characterId: character.id,
      characterVersionId: character.versionId,
    });

    const mission = parsed.data.missionId
      ? await resolveResourceSnapshot(client, "missions", parsed.data.missionId)
      : undefined;
    if (mission) {
      await loadPublishedMissionRuntime(admin, {
        missionId: mission.id,
        missionVersionId: mission.versionId,
      });
      const assignment = await admin
        .from("mission_characters")
        .select("mission_id")
        .eq("mission_id", mission.id)
        .eq("character_id", character.id)
        .limit(1);
      assertDatabaseSuccess(assignment.error, "mission_characters.conversation");
      if (!(assignment.data ?? []).length) {
        throw new SupabaseHttpError(
          409,
          "MISSION_CHARACTER_MISMATCH",
          "The selected character is not available for this mission.",
        );
      }
    }

    const result = await client
      .from("conversations")
      .insert({
        id: parsed.data.id ?? crypto.randomUUID(),
        owner_id: user.id,
        metadata: { creationRequest, initialTitleMode: parsed.data.titleMode ?? "manual" },
        character_id: character.id,
        character_version_id: character.versionId,
        mission_id: mission?.id ?? null,
        mission_version_id: mission?.versionId ?? null,
        title: parsed.data.title,
        visibility: parsed.data.visibility,
        model_id: requireAllowedChatModel(parsed.data.modelId),
      })
      .select(`${conversationColumns}, share_token`)
      .limit(1);
    if (result.error?.code === "23505" && parsed.data.id) {
      const existing = await findCreatedConversation(client, parsed.data.id, user.id, creationRequest);
      if (existing) return jsonSuccessResponse(requestId, { item: conversationDto(existing), replayed: true });
    }
    if (result.error) throwMutationError(result.error, "conversations.create");
    const row = (result.data ?? [])[0];
    if (!row) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The conversation could not be created.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, {
      item: conversationDto(row),
      ...(row.visibility !== "private" ? { shareToken: row.share_token } : {}),
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
