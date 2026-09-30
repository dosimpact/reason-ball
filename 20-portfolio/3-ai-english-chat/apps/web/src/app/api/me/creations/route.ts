import { loadOwnedCreations } from "@/entities/creator-content/api/server-creations";
import { createRequestClient, createRequestId, jsonSuccessResponse, requireAuthenticatedUser, safeSupabaseErrorResponse } from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    return jsonSuccessResponse(requestId, { creations: await loadOwnedCreations(client, user.id) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
