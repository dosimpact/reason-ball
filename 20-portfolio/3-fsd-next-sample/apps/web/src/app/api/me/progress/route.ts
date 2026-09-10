import { loadLearningProgress } from "@/entities/learning-session/api/server-progress";
import { loadLearningNotebook } from "@/entities/learning-notebook/api/server-notebook";
import { countNotebookExpressions } from "@/entities/learning-notebook/model/notebook";
import { createRequestClient, createRequestId, jsonSuccessResponse, requireAuthenticatedUser, safeSupabaseErrorResponse } from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const notebook = await loadLearningNotebook(client, user.id);
    return jsonSuccessResponse(requestId, { progress: await loadLearningProgress(client, user.id, new Date().toISOString().slice(0, 10), countNotebookExpressions(notebook)) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
