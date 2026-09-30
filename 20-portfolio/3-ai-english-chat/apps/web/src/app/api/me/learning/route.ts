import {
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
} from "@/shared/api/supabase/http";
import { getLearningSnapshot } from "@/shared/api/supabase/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();

  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const snapshot = await getLearningSnapshot(client, user.id);
    return jsonSuccessResponse(requestId, { snapshot });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
