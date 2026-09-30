import { branchMessageSchema, messageDto } from "@/shared/api/supabase/chatbot";
import { uuidSchema } from "@/shared/api/supabase/domain";
import {
  assertDatabaseSuccess, assertTrustedMutationRequest, createPrivilegedClient,
  createRequestClient, createRequestId, jsonSuccessResponse, parseJsonBody,
  requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError, throwMutationError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string; messageId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const params = await context.params;
    const conversationId = uuidSchema.safeParse(params.id);
    const messageId = uuidSchema.safeParse(params.messageId);
    if (!conversationId.success || !messageId.success) {
      throw new SupabaseHttpError(400, "INVALID_MESSAGE_BRANCH", "The conversation or message id is invalid.");
    }
    const parsed = await parseJsonBody(request, branchMessageSchema, requestId, 256 * 1024);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const result = await admin.rpc("replace_message_branch", {
      _conversation_id: conversationId.data, _owner_id: user.id,
      _source_id: messageId.data, _expected_tail_id: parsed.data.expectedTailId,
      _request_id: parsed.data.requestId, _parts: parsed.data.parts,
    });
    if (result.error) throwMutationError(result.error, "messages.replace_branch");
    const restored = await admin.from("messages").select(
      "id, client_message_id, conversation_id, role, status, parts, plain_text, parent_message_id, model_id, finish_reason, sequence_number, created_at, updated_at",
    ).eq("conversation_id", conversationId.data).eq("id", result.data).maybeSingle();
    assertDatabaseSuccess(restored.error, "messages.branch_readback");
    if (!restored.data) throw new SupabaseHttpError(409, "MESSAGE_BRANCH_CHANGED", "The edited branch changed before it could be restored.");
    return jsonSuccessResponse(requestId, { item: messageDto(restored.data), branchedFromMessageId: messageId.data });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
