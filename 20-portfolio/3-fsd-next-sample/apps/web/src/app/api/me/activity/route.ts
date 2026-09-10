import { activityRequestSchema, activityResponseSchema } from "@/entities/learning-session/model/activity";
import { assertTrustedMutationRequest, createRequestClient, createRequestId, jsonSuccessResponse, parseJsonBody, requireAuthenticatedUser, safeSupabaseErrorResponse, throwMutationError } from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(request, activityRequestSchema, requestId, 2048);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    await requireAuthenticatedUser(client);
    const result = await client.rpc("record_learning_activity", {
      _conversation_id: parsed.data.conversationId, _request_id: parsed.data.requestId, _active: parsed.data.active,
    });
    if (result.error) throwMutationError(result.error, "learning_activity.record");
    const row = result.data?.[0];
    return jsonSuccessResponse(requestId, { activity: activityResponseSchema.parse({ acceptedSeconds: row?.accepted_seconds, recordedAt: row?.recorded_at }) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
