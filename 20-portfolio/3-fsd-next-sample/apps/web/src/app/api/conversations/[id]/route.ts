import {
  conversationDto,
  conversationPatchSchema,
  requireAllowedChatModel,
} from "@/shared/api/supabase/chatbot";
import { uuidSchema } from "@/shared/api/supabase/domain";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const columns =
  "id, owner_id, character_id, character_version_id, mission_id, mission_version_id, title, visibility, status, model_id, share_token, last_message_at, created_at, updated_at";

async function routeId(context: RouteContext) {
  const parsed = uuidSchema.safeParse((await context.params).id);
  if (!parsed.success) {
    throw new SupabaseHttpError(
      400,
      "INVALID_CONVERSATION_ID",
      "The conversation id is invalid.",
    );
  }
  return parsed.data;
}

async function ownedConversation(
  admin: ReturnType<typeof createPrivilegedClient>,
  id: string,
  ownerId: string,
) {
  const result = await admin
    .from("conversations")
    .select(columns)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .limit(1);
  assertDatabaseSuccess(result.error, "conversations.require_owner");
  const row = (result.data ?? [])[0];
  if (!row) {
    throw new SupabaseHttpError(
      404,
      "CONVERSATION_NOT_FOUND",
      "The conversation could not be found.",
    );
  }
  return row;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    const id = await routeId(context);
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const row = await ownedConversation(createPrivilegedClient(), id, user.id);
    if (row.status === "deleted") {
      throw new SupabaseHttpError(
        404,
        "CONVERSATION_NOT_FOUND",
        "The conversation could not be found.",
      );
    }
    const run = row.mission_id ? await client.from("mission_runs")
      .select("id").eq("owner_id", user.id).eq("conversation_id", id)
      .order("created_at", { ascending: false }).limit(1) : undefined;
    if (run) assertDatabaseSuccess(run.error, "conversations.mission_run");
    return jsonSuccessResponse(requestId, { item: { ...conversationDto(row), missionRunId: run?.data?.[0]?.id } });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = await routeId(context);
    const parsed = await parseJsonBody(
      request,
      conversationPatchSchema,
      requestId,
      8 * 1024,
    );
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const current = await ownedConversation(admin, id, user.id);

    const changes: Record<string, unknown> = {};
    if (parsed.data.action === "update") {
      if (current.status === "deleted") {
        throw new SupabaseHttpError(
          409,
          "CONVERSATION_DELETED",
          "Restore the conversation before updating it.",
        );
      }
      if (parsed.data.title !== undefined) changes.title = parsed.data.title;
      if (parsed.data.modelId !== undefined) {
        if (current.status !== "active") throw new SupabaseHttpError(409, "CONVERSATION_NOT_ACTIVE", "Restore the conversation before changing its model.");
        changes.model_id = requireAllowedChatModel(parsed.data.modelId);
      }
      if (parsed.data.visibility !== undefined) {
        changes.visibility = parsed.data.visibility;
      }
    } else if (parsed.data.action === "archive") {
      changes.status = "archived";
    } else if (parsed.data.action === "restore") {
      changes.status = "active";
    } else {
      changes.share_token = crypto.randomUUID();
    }

    let update = admin
      .from("conversations")
      .update(changes)
      .eq("id", id)
      .eq("owner_id", user.id);
    if (parsed.data.action === "update") update = update.neq("status", "deleted");
    if (changes.model_id !== undefined) update = update.eq("status", "active");
    const result = await update
      .select(columns)
      .limit(1);
    assertDatabaseSuccess(result.error, "conversations.update_owned");
    const row = (result.data ?? [])[0];
    if (!row) {
      throw new SupabaseHttpError(
        409,
        "CONVERSATION_UPDATE_CONFLICT",
        "The conversation could not be updated.",
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

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = await routeId(context);
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    await ownedConversation(admin, id, user.id);

    if (new URL(request.url).searchParams.get("purge") === "true") {
      const result = await admin.rpc("purge_deleted_conversation", {
        _conversation_id: id,
        _expected_owner_id: user.id,
      });
      if (result.error) throwMutationError(result.error, "conversations.purge");
      return jsonSuccessResponse(requestId, { deleted: true, purged: true });
    }

    const result = await admin
      .from("conversations")
      .update({ status: "deleted", visibility: "private" })
      .eq("id", id)
      .eq("owner_id", user.id);
    assertDatabaseSuccess(result.error, "conversations.soft_delete");
    return jsonSuccessResponse(requestId, { deleted: true, purged: false });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
