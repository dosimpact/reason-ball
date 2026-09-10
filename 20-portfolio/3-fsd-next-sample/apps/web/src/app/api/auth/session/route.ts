import { publicUser } from "@/shared/api/supabase/auth";
import {
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  safeSupabaseErrorResponse,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();

  try {
    const client = await createRequestClient();
    const result = await client.auth.getUser();
    return jsonSuccessResponse(requestId, {
      user: result.data.user ? publicUser(result.data.user) : null,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
