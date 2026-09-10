import {
  learningHistoryDraftSchema,
  touchLearningHistory,
} from "@/shared/api/supabase/domain";
import {
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const parsed = await parseJsonBody(
      request,
      learningHistoryDraftSchema,
      requestId,
    );
    if (!parsed.ok) return parsed.response;

    const history = await touchLearningHistory(client, user.id, parsed.data);
    return jsonSuccessResponse(requestId, { history });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
