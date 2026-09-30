import { generateText } from "ai";
import { z } from "zod";

import { createAiCapabilities, createRequestId, enforceAiRateLimit, jsonSuccessResponse, parseJsonBody, safeAiErrorResponse } from "@/shared/api/ai";
import { assertTrustedMutationRequest, createRequestClient, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";
import { playgroundUnavailableResponse } from "@/shared/lib/playground-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4_000),
  }).strict()).min(1).max(20),
}).strict();

export async function POST(request: Request) {
  const unavailable = playgroundUnavailableResponse(process.env);
  if (unavailable) return unavailable;
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const mock = process.env.APP_RUNTIME_MODE === "mock" || process.env.AI_PROVIDER === "mock";
    const user = mock ? undefined : await requireAuthenticatedUser(await createRequestClient());
    const limited = enforceAiRateLimit(request, requestId, { operation: "chat", authenticatedUserId: user?.id, limit: 20, windowMs: 60_000 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, chatSchema, requestId, 96 * 1024);
    if (!parsed.ok) return parsed.response;
    const capabilities = createAiCapabilities({ operation: "chat" });
    const result = await generateText({
      model: capabilities.languageModel,
      system: "You are a friendly English conversation partner. Answer briefly and naturally. This is a temporary API playground conversation.",
      messages: parsed.data.messages,
      maxOutputTokens: 600,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
      maxRetries: 0,
    });
    return jsonSuccessResponse(requestId, { text: result.text, modelId: capabilities.modelIds.chat, provider: capabilities.providerName });
  } catch (error) {
    return error instanceof SupabaseHttpError ? safeSupabaseErrorResponse(error, requestId) : safeAiErrorResponse(error, requestId);
  }
}
