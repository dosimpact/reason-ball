import "server-only";

import { createHash } from "node:crypto";
import { apiErrorResponse } from "./errors";

type RateBucket = { count: number; resetAt: number };
type RateLimitOptions = { operation: string; limit: number; windowMs: number; authenticatedUserId?: string };

const globalBuckets = globalThis as typeof globalThis & {
  __linguaAiRateBuckets?: Map<string, RateBucket>;
};

const buckets = globalBuckets.__linguaAiRateBuckets ?? new Map<string, RateBucket>();
globalBuckets.__linguaAiRateBuckets = buckets;

function requestScope(request: Request) {
  const credential = request.headers.get("authorization");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(credential || address).digest("hex").slice(0, 24);
}

export function enforceAiRateLimit(
  request: Request,
  requestId: string,
  { operation, limit, windowMs, authenticatedUserId }: RateLimitOptions,
) {
  const now = Date.now();
  const scope = authenticatedUserId
    ? createHash("sha256").update(`user:${authenticatedUserId}`).digest("hex").slice(0, 24)
    : requestScope(request);
  const key = `${operation}:${scope}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count <= limit) return null;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
  return apiErrorResponse(
    requestId,
    429,
    {
      code: "RATE_LIMITED",
      message: "Too many AI requests. Please wait before trying again.",
      retryable: true,
    },
    {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1_000)),
    },
  );
}

export function recordAiObservation(input: {
  requestId: string;
  operation: string;
  provider?: string;
  model?: string;
  startedAt: number;
  outcome: "success" | "error" | "aborted";
  usage?: unknown;
  conversationId?: string;
  assistantMessageId?: string;
}) {
  console.info("AI operation", {
    requestId: input.requestId,
    operation: input.operation,
    conversationId: input.conversationId,
    assistantMessageId: input.assistantMessageId,
    provider: input.provider,
    model: input.model,
    outcome: input.outcome,
    durationMs: Date.now() - input.startedAt,
    usage: input.usage,
  });
}
