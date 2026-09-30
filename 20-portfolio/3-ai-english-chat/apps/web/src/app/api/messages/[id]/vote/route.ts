import { voteSchema } from "@/shared/api/supabase/chatbot";
import { uuidSchema } from "@/shared/api/supabase/domain";
import {
  assertDatabaseSuccess,
  assertTrustedMutationRequest,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function messageId(context: RouteContext) {
  const parsed = uuidSchema.safeParse((await context.params).id);
  if (!parsed.success) {
    throw new SupabaseHttpError(
      400,
      "INVALID_MESSAGE_ID",
      "The message id is invalid.",
    );
  }
  return parsed.data;
}

async function requireVotableMessage(
  client: Awaited<ReturnType<typeof createRequestClient>>,
  id: string,
) {
  const result = await client
    .from("messages")
    .select("id")
    .eq("id", id)
    .eq("role", "assistant")
    .eq("status", "complete")
    .limit(1);
  assertDatabaseSuccess(result.error, "messages.vote_target");
  if (!(result.data ?? []).length) {
    throw new SupabaseHttpError(
      404,
      "MESSAGE_NOT_FOUND",
      "The votable assistant message could not be found.",
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = await messageId(context);
    const parsed = await parseJsonBody(request, voteSchema, requestId, 8 * 1024);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    await requireVotableMessage(client, id);
    const result = await client
      .from("message_feedback")
      .upsert(
        {
          user_id: user.id,
          message_id: id,
          rating: parsed.data.rating,
          reason: parsed.data.reason ?? null,
        },
        { onConflict: "user_id,message_id" },
      )
      .select("message_id, rating, reason, updated_at")
      .limit(1);
    assertDatabaseSuccess(result.error, "message_feedback.upsert");
    const vote = (result.data ?? [])[0];
    if (!vote) throw new SupabaseHttpError(502, "DATA_SERVICE_ERROR", "The saved feedback could not be read.", true);
    return jsonSuccessResponse(requestId, { vote });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = await messageId(context);
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const result = await client
      .from("message_feedback")
      .delete()
      .eq("user_id", user.id)
      .eq("message_id", id);
    assertDatabaseSuccess(result.error, "message_feedback.delete");
    return jsonSuccessResponse(requestId, { deleted: true });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
