import { anonymousSignInSchema, publicUser } from "@/shared/api/supabase/auth";
import {
  assertTrustedMutationRequest,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
  throwAuthError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(
      request,
      anonymousSignInSchema,
      requestId,
      16 * 1024,
    );
    if (!parsed.ok) return parsed.response;

    if (
      process.env.AUTH_REQUIRE_CAPTCHA?.trim() === "true" &&
      !parsed.data.captchaToken
    ) {
      throw new SupabaseHttpError(
        400,
        "CAPTCHA_REQUIRED",
        "A CAPTCHA token is required for anonymous sign-in.",
      );
    }

    const client = await createRequestClient();
    const current = await client.auth.getUser();
    if (current.data.user) {
      return jsonSuccessResponse(requestId, {
        user: publicUser(current.data.user),
        created: false,
      });
    }

    const result = await client.auth.signInAnonymously(
      parsed.data.captchaToken
        ? { options: { captchaToken: parsed.data.captchaToken } }
        : undefined,
    );
    if (result.error) throwAuthError(result.error, "auth.sign_in_anonymously");
    if (!result.data.user) {
      throw new SupabaseHttpError(
        502,
        "AUTH_SERVICE_ERROR",
        "The authentication service returned no user.",
        true,
      );
    }

    return jsonSuccessResponse(requestId, {
      user: publicUser(result.data.user),
      created: true,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
