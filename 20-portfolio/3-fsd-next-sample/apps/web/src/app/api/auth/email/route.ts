import {
  authCallbackUrl,
  emailAuthSchema,
  publicUser,
} from "@/shared/api/supabase/auth";
import {
  assertTrustedMutationRequest,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  requireAuthenticatedUser,
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
      emailAuthSchema,
      requestId,
      32 * 1024,
    );
    if (!parsed.ok) return parsed.response;

    const client = await createRequestClient();
    const action = parsed.data.action;

    if (action === "sign-in" || action === "sign-up") {
      const current = await client.auth.getUser();
      if (current.data.user?.is_anonymous) {
        throw new SupabaseHttpError(
          409,
          "ANONYMOUS_LINK_REQUIRED",
          "Link the email to the anonymous account, or sign out before using another account.",
        );
      }
    }

    if (action === "sign-in") {
      const result = await client.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (result.error) throwAuthError(result.error, "auth.sign_in_password");
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
        emailConfirmationRequired: false,
      });
    }

    if (action === "sign-up") {
      const result = await client.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: authCallbackUrl(request, parsed.data.next),
          ...(parsed.data.captchaToken
            ? { captchaToken: parsed.data.captchaToken }
            : {}),
        },
      });
      if (result.error) throwAuthError(result.error, "auth.sign_up");
      return jsonSuccessResponse(requestId, {
        user: result.data.user ? publicUser(result.data.user) : null,
        emailConfirmationRequired: !result.data.session,
      });
    }

    const user = await requireAuthenticatedUser(client);

    if (action === "link-email") {
      if (!user.is_anonymous) {
        throw new SupabaseHttpError(
          409,
          "ACCOUNT_ALREADY_PERMANENT",
          "The current account already has a permanent identity.",
        );
      }
      const result = await client.auth.updateUser(
        { email: parsed.data.email },
        { emailRedirectTo: authCallbackUrl(request, parsed.data.next) },
      );
      if (result.error) throwAuthError(result.error, "auth.link_email");
      return jsonSuccessResponse(requestId, {
        user: publicUser(result.data.user),
        emailConfirmationRequired: true,
      });
    }

    if (user.is_anonymous || !user.email_confirmed_at) {
      throw new SupabaseHttpError(
        403,
        "VERIFIED_EMAIL_REQUIRED",
        "Verify the linked email before setting a password.",
      );
    }
    const result = await client.auth.updateUser({
      password: parsed.data.password,
      ...(parsed.data.nonce ? { nonce: parsed.data.nonce } : {}),
    });
    if (result.error) throwAuthError(result.error, "auth.set_password");
    return jsonSuccessResponse(requestId, {
      user: publicUser(result.data.user),
      emailConfirmationRequired: false,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
