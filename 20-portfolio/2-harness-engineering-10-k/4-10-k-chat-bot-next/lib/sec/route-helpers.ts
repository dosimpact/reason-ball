import type { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { withRequestIdHeader } from "@/lib/request-id";
import { toSecApiErrorResponse } from "@/lib/sec/api-response";

export async function requireSecApiUser(requestId: string) {
  const session = await auth();

  if (!session?.user) {
    return withRequestIdHeader(
      new ChatSDKError("unauthorized:chat").toResponse(),
      requestId
    );
  }

  return null;
}

export async function parseSecJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
  requestId: string
): Promise<z.infer<TSchema> | Response> {
  try {
    return schema.parse(await request.json());
  } catch {
    return toSecApiErrorResponse(
      new ChatSDKError("bad_request:api", "Invalid request body"),
      requestId
    );
  }
}

export function parseBoundedInteger({
  value,
  fallback,
  min,
  max,
}: {
  value: string | null;
  fallback: number;
  min: number;
  max: number;
}) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}
