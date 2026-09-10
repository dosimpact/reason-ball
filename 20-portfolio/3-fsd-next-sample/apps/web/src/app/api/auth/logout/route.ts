import {
  assertTrustedMutationRequest,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  safeSupabaseErrorResponse,
  throwAuthError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    assertTrustedMutationRequest(request);
    const client = await createRequestClient();
    const result = await client.auth.signOut({ scope: "local" });
    if (result.error) throwAuthError(result.error, "auth.sign_out");
    return jsonSuccessResponse(requestId, { signedOut: true });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
