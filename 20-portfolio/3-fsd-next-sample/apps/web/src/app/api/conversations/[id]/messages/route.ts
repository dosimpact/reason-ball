import {
  appendMessageSchema,
  messageDto,
  plainTextFromParts,
} from "@/shared/api/supabase/chatbot";
import { uuidSchema } from "@/shared/api/supabase/domain";
import { z } from "zod";
import {
  assertDatabaseSuccess,
  assertTrustedMutationRequest,
  createRequestClient,
  createPrivilegedClient,
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
const messageColumns =
  "id, client_message_id, conversation_id, role, status, parts, plain_text, parent_message_id, model_id, finish_reason, sequence_number, created_at, updated_at";

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = await conversationId(context);
    const parsed = await parseJsonBody(request, z.object({
      confirmation: z.literal("CLEAR MESSAGES"), requestId: z.uuid(),
    }).strict(), requestId, 1024);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const result = await createPrivilegedClient().rpc("clear_conversation_messages", {
      _conversation_id: id, _owner_id: user.id, _request_id: parsed.data.requestId,
    });
    if (result.error?.code === "55000") throw new SupabaseHttpError(409, "CONVERSATION_NOT_CLEARABLE", "응답 생성이 끝난 활성 대화에서만 메시지를 초기화할 수 있어요.", true);
    if (result.error) throwMutationError(result.error, "conversations.clear_messages");
    return jsonSuccessResponse(requestId, { cleared: true, deletedCount: result.data });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

async function conversationId(context: RouteContext) {
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

async function requireActiveOwnedConversation(
  client: Awaited<ReturnType<typeof createRequestClient>>,
  id: string,
  ownerId: string,
  mustBeActive = true,
) {
  const result = await client
    .from("conversations")
    .select("id, status")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .neq("status", "deleted")
    .limit(1);
  assertDatabaseSuccess(result.error, "conversations.messages_owner");
  const row = (result.data ?? [])[0];
  if (!row) {
    throw new SupabaseHttpError(
      404,
      "CONVERSATION_NOT_FOUND",
      "The conversation could not be found.",
    );
  }
  if (mustBeActive && row.status !== "active") {
    throw new SupabaseHttpError(
      409,
      "CONVERSATION_NOT_ACTIVE",
      "Restore the archived conversation before sending a message.",
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    const id = await conversationId(context);
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    await requireActiveOwnedConversation(client, id, user.id, false);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.trunc(requestedLimit)))
      : 100;
    let query = client
      .from("messages")
      .select(messageColumns)
      .eq("conversation_id", id)
      .neq("role", "system")
      .order("sequence_number", { ascending: true })
      .limit(limit);
    const after = Number(url.searchParams.get("after"));
    if (Number.isFinite(after) && after > 0) {
      query = query.gt("sequence_number", Math.trunc(after));
    }
    const result = await query;
    assertDatabaseSuccess(result.error, "messages.list");
    const rows = result.data ?? [];
    const ids = rows.filter((row) => row.role === "assistant" && row.status === "complete").map((row) => row.id);
    const votes = new Map<string, { rating: number; reason: string | null }>();
    if (ids.length) {
      const feedback = await client.from("message_feedback")
        .select("message_id, rating, reason").eq("user_id", user.id).in("message_id", ids);
      assertDatabaseSuccess(feedback.error, "message_feedback.list_self");
      for (const row of feedback.data ?? []) votes.set(row.message_id, { rating: row.rating, reason: row.reason });
    }
    return jsonSuccessResponse(requestId, {
      items: rows.map((row) => ({ ...messageDto(row), vote: votes.get(row.id) ?? null })),
      hasMore: (result.data ?? []).length === limit,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = await conversationId(context);
    const parsed = await parseJsonBody(
      request,
      appendMessageSchema,
      requestId,
      256 * 1024,
    );
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    await requireActiveOwnedConversation(client, id, user.id);

    if (parsed.data.clientMessageId) {
      const existing = await client
        .from("messages")
        .select(messageColumns)
        .eq("conversation_id", id)
        .eq("client_message_id", parsed.data.clientMessageId)
        .limit(1);
      assertDatabaseSuccess(existing.error, "messages.idempotency_lookup");
      const row = (existing.data ?? [])[0];
      if (row) {
        return jsonSuccessResponse(requestId, {
          item: messageDto(row),
          replayed: true,
        });
      }
    }

    const result = await client
      .from("messages")
      .insert({
        id: parsed.data.id ?? crypto.randomUUID(),
        conversation_id: id,
        author_id: user.id,
        role: "user",
        status: "complete",
        parts: parsed.data.parts,
        plain_text: plainTextFromParts(parsed.data.parts),
        parent_message_id: parsed.data.parentMessageId ?? null,
        client_message_id: parsed.data.clientMessageId ?? null,
      })
      .select(messageColumns)
      .limit(1);
    if (result.error?.code === "22023") {
      throw new SupabaseHttpError(400, "INVALID_MESSAGE_CONTENT", "The message contains invalid content or attachment references.");
    }
    if (result.error) throwMutationError(result.error, "messages.append_user");
    const row = (result.data ?? [])[0];
    if (!row) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The message could not be appended.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, {
      item: messageDto(row),
      replayed: false,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
