import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ZodError, ZodType } from "zod";

import { createAdminClient } from "./admin";
import { createClient as createServerClient } from "./server";

type FieldErrors = Record<string, string[]>;

type ApiErrorPayload = {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
  fieldErrors?: FieldErrors;
};

type DatabaseError = {
  code?: string;
};

type AuthError = {
  code?: string;
  status?: number;
};

export class SupabaseHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly diagnosticCode?: string,
  ) {
    super(message);
    this.name = "SupabaseHttpError";
  }
}

export function createRequestId() {
  return crypto.randomUUID();
}

function collectFieldErrors(error: ZodError): FieldErrors {
  return error.issues.reduce<FieldErrors>((fieldErrors, issue) => {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
    return fieldErrors;
  }, {});
}

export function apiErrorResponse(
  requestId: string,
  status: number,
  payload: Omit<ApiErrorPayload, "requestId">,
) {
  return Response.json(
    {
      error: {
        code: payload.code,
        message: payload.message,
        retryable: payload.retryable,
        ...(payload.fieldErrors
          ? { fieldErrors: payload.fieldErrors }
          : {}),
      },
      requestId,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

export function jsonSuccessResponse(requestId: string, payload: unknown) {
  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}

export function assertTrustedMutationRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new SupabaseHttpError(
      403,
      "CROSS_SITE_REQUEST_BLOCKED",
      "Cross-site mutation requests are not allowed.",
    );
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowedOrigins = new Set<string>([new URL(request.url).origin]);
  const configuredOrigins = [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    ...(process.env.APP_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()),
  ].filter((value): value is string => Boolean(value));
  for (const configuredOrigin of configuredOrigins) {
    try {
      const url = new URL(configuredOrigin);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Invalid application origin");
      }
      allowedOrigins.add(url.origin);
    } catch {
      throw new SupabaseHttpError(
        503,
        "APP_ORIGIN_NOT_CONFIGURED",
        "The application origin is not configured correctly.",
      );
    }
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    throw new SupabaseHttpError(
      403,
      "INVALID_REQUEST_ORIGIN",
      "The request origin is invalid.",
    );
  }

  if (!allowedOrigins.has(requestOrigin)) {
    throw new SupabaseHttpError(
      403,
      "CROSS_SITE_REQUEST_BLOCKED",
      "Cross-site mutation requests are not allowed.",
    );
  }
}

type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  requestId: string,
  maxBytes = 512 * 1024,
): Promise<ParsedBody<T>> {
  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      ok: false,
      response: apiErrorResponse(requestId, 413, {
        code: "REQUEST_TOO_LARGE",
        message: "The request body is too large.",
        retryable: false,
      }),
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    return {
      ok: false,
      response: apiErrorResponse(requestId, 413, {
        code: "REQUEST_TOO_LARGE",
        message: "The request body is too large.",
        retryable: false,
      }),
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return {
      ok: false,
      response: apiErrorResponse(requestId, 400, {
        code: "INVALID_JSON",
        message: "The request body must be valid JSON.",
        retryable: false,
      }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiErrorResponse(requestId, 400, {
        code: "VALIDATION_ERROR",
        message: "The request body is invalid.",
        retryable: false,
        fieldErrors: collectFieldErrors(parsed.error),
      }),
    };
  }

  return { ok: true, data: parsed.data };
}

export async function createRequestClient() {
  try {
    return await createServerClient();
  } catch {
    throw new SupabaseHttpError(
      503,
      "DATA_SERVICE_NOT_CONFIGURED",
      "The data service is not configured for this environment.",
    );
  }
}

export function createPrivilegedClient() {
  try {
    return createAdminClient();
  } catch {
    throw new SupabaseHttpError(
      503,
      "DATA_SERVICE_NOT_CONFIGURED",
      "The data service is not configured for this environment.",
    );
  }
}

export async function requireAuthenticatedUser(
  client: SupabaseClient,
): Promise<User> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new SupabaseHttpError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required for this operation.",
    );
  }

  return user;
}

export function assertDatabaseSuccess(
  error: DatabaseError | null,
  diagnosticCode: string,
): asserts error is null {
  if (!error) {
    return;
  }

  throw new SupabaseHttpError(
    502,
    "DATA_SERVICE_ERROR",
    "The data service could not complete the request.",
    true,
    `${diagnosticCode}:${error.code ?? "unknown"}`,
  );
}

export function throwMutationError(
  error: DatabaseError,
  operation: string,
): never {
  if (error.code === "P2001") {
    throw new SupabaseHttpError(409, "MISSION_PREREQUISITES_REQUIRED", "선수 미션을 먼저 완료해 주세요.");
  }
  if (error.code === "P0002") {
    throw new SupabaseHttpError(
      404,
      "RESOURCE_NOT_FOUND",
      "The requested resource could not be found.",
    );
  }
  if (error.code === "42501") {
    throw new SupabaseHttpError(
      403,
      "RESOURCE_FORBIDDEN",
      "The authenticated user cannot modify this resource.",
    );
  }
  if (error.code === "23505") {
    throw new SupabaseHttpError(
      409,
      "RESOURCE_CONFLICT",
      "A resource with the same identifier already exists.",
    );
  }
  if (error.code === "40001" || error.code === "PT409") {
    throw new SupabaseHttpError(
      409,
      "VERSION_CONFLICT",
      "This resource changed after it was loaded. Refresh it before saving again.",
      true,
    );
  }
  if (
    error.code === "22023" ||
    error.code === "22P02" ||
    error.code === "23502" ||
    error.code === "23514" ||
    error.code === "55000"
  ) {
    throw new SupabaseHttpError(
      409,
      "INVALID_RESOURCE_STATE",
      "The resource does not satisfy the publication requirements.",
    );
  }

  throw new SupabaseHttpError(
    502,
    "DATA_SERVICE_ERROR",
    "The data service could not complete the mutation.",
    true,
    `${operation}:${error.code ?? "unknown"}`,
  );
}

export function throwAuthError(error: AuthError, operation: string): never {
  if (
    error.code === "invalid_credentials" ||
    error.code === "invalid_grant" ||
    error.code === "user_not_found"
  ) {
    throw new SupabaseHttpError(
      401,
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }
  if (error.code === "email_not_confirmed") {
    throw new SupabaseHttpError(
      403,
      "EMAIL_NOT_CONFIRMED",
      "Confirm the email address before signing in.",
    );
  }
  if (
    error.code === "user_already_exists" ||
    error.code === "identity_already_exists" ||
    error.code === "email_exists"
  ) {
    throw new SupabaseHttpError(
      409,
      "IDENTITY_CONFLICT",
      "That identity cannot be linked to this account.",
    );
  }
  if (error.code === "weak_password") {
    throw new SupabaseHttpError(
      400,
      "WEAK_PASSWORD",
      "The password does not satisfy the configured security policy.",
    );
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    throw new SupabaseHttpError(
      429,
      "AUTH_RATE_LIMITED",
      "Too many authentication attempts were made. Try again later.",
      true,
    );
  }

  throw new SupabaseHttpError(
    502,
    "AUTH_SERVICE_ERROR",
    "The authentication service could not complete the request.",
    true,
    `${operation}:${error.code ?? "unknown"}`,
  );
}

export function safeSupabaseErrorResponse(
  error: unknown,
  requestId: string,
) {
  if (error instanceof SupabaseHttpError) {
    if (error.diagnosticCode) {
      console.error("Supabase request failed", {
        requestId,
        errorName: error.name,
        diagnosticCode: error.diagnosticCode,
      });
    }

    return apiErrorResponse(requestId, error.status, {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    });
  }

  console.error("Supabase request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });

  return apiErrorResponse(requestId, 500, {
    code: "INTERNAL_ERROR",
    message: "The request could not be completed.",
    retryable: false,
  });
}
