import { z } from "zod";
import { messageDto } from "@/shared/api/supabase/chatbot";
import {
  assertDatabaseSuccess, assertTrustedMutationRequest, createPrivilegedClient,
  createRequestClient, createRequestId, jsonSuccessResponse, parseJsonBody,
  requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError, throwMutationError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string; messageId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const route = z.object({ id: z.uuid(), messageId: z.uuid() }).safeParse(await context.params);
    if (!route.success) throw new SupabaseHttpError(400, "INVALID_REGENERATION_ID", "The conversation or answer ID is invalid.");
    const parsed = await parseJsonBody(request, z.object({ requestId: z.uuid() }).strict(), requestId, 1024);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const result = await admin.rpc("prepare_response_regeneration", {
      _conversation_id: route.data.id, _owner_id: user.id,
      _assistant_id: route.data.messageId, _request_id: parsed.data.requestId,
    });
    if (result.error) throwMutationError(result.error, "messages.prepare_regeneration");
    const row = await admin.from("messages").select("id, client_message_id, conversation_id, role, status, parts, plain_text, parent_message_id, model_id, finish_reason, sequence_number, created_at, updated_at")
      .eq("conversation_id", route.data.id).eq("id", result.data).maybeSingle();
    assertDatabaseSuccess(row.error, "messages.regeneration_user");
    if (!row.data) throw new SupabaseHttpError(409, "REGENERATION_CHANGED", "The user turn changed before it could be restored.");
    return jsonSuccessResponse(requestId, { item: messageDto(row.data) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
