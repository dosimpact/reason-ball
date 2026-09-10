import { loadSavedMissions, remoteSavedMissionRequestSchema, saveMissionPreference } from "@/entities/mission/api/server-saved-missions";
import { assertTrustedMutationRequest, createRequestClient, createRequestId, jsonSuccessResponse, parseJsonBody, requireAuthenticatedUser, safeSupabaseErrorResponse } from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    return jsonSuccessResponse(requestId, { items: await loadSavedMissions(client, user.id) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}

export async function PUT(request: Request) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(request, remoteSavedMissionRequestSchema, requestId, 2048);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    await requireAuthenticatedUser(client);
    return jsonSuccessResponse(requestId, { result: await saveMissionPreference(client, parsed.data) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
