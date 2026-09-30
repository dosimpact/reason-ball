import { loadLearningPreferences, saveLearningPreferences } from "@/entities/learner/api/server-preferences";
import { preferenceUpdateSchema } from "@/entities/learner/model/preferences";
import { assertTrustedMutationRequest, createRequestClient, createRequestId, jsonSuccessResponse, parseJsonBody, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    return jsonSuccessResponse(requestId, { preferences: await loadLearningPreferences(client, user.id) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}

export async function PATCH(request: Request) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(request, preferenceUpdateSchema, requestId, 8 * 1024);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    if (parsed.data.expectedOwnerId !== user.id) throw new SupabaseHttpError(409, "PREFERENCE_ACCOUNT_CHANGED", "계정이 바뀌었어요. 설정을 다시 불러와 주세요.");
    return jsonSuccessResponse(requestId, { preferences: await saveLearningPreferences(client, user.id, parsed.data.expectedRevision, parsed.data.settings) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
