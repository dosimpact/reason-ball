import { loadLearningNotebook, remoteNotebookRequestSchema, saveLearningNotebook } from "@/entities/learning-notebook/api/server-notebook";
import { assertTrustedMutationRequest, createPrivilegedClient, createRequestClient, createRequestId, jsonSuccessResponse, parseJsonBody, requireAuthenticatedUser, safeSupabaseErrorResponse } from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    return jsonSuccessResponse(requestId, { notebook: await loadLearningNotebook(client, user.id) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(request, remoteNotebookRequestSchema, requestId, 32 * 1024);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const saved = await saveLearningNotebook(createPrivilegedClient(), user.id, parsed.data);
    return jsonSuccessResponse(requestId, saved);
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
