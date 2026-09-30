import "server-only";

import type { ZodError, ZodType } from "zod";

type FieldErrors = Record<string, string[]>;

type ErrorPayload = {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
  fieldErrors?: FieldErrors;
};

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export class AiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AiHttpError";
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
  payload: Omit<ErrorPayload, "requestId">,
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Request-Id", requestId);
  return Response.json(
    { ...payload, requestId },
    {
      status,
      headers: responseHeaders,
    },
  );
}

export function jsonSuccessResponse(
  requestId: string,
  payload: unknown,
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Request-Id", requestId);

  return Response.json(payload, { headers: responseHeaders });
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

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: apiErrorResponse(requestId, 400, {
        code: "VALIDATION_ERROR",
        message: "The request body is invalid.",
        retryable: false,
        fieldErrors: collectFieldErrors(result.error),
      }),
    };
  }

  return { ok: true, data: result.data };
}

export function safeAiErrorResponse(error: unknown, requestId: string) {
  if (error instanceof AiHttpError) {
    return apiErrorResponse(requestId, error.status, {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    });
  }

  if (error instanceof AiConfigurationError) {
    return apiErrorResponse(requestId, 503, {
      code: "AI_NOT_CONFIGURED",
      message: "The AI service is not configured for this environment.",
      retryable: false,
    });
  }

  console.error("AI request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });

  return apiErrorResponse(requestId, 502, {
    code: "AI_PROVIDER_ERROR",
    message: "The AI service could not complete the request.",
    retryable: true,
  });
}
