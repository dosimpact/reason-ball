import { z } from "zod";
import { AiConfigurationError, AiHttpError, createRequestId, enforceAiRateLimit, jsonSuccessResponse, parseJsonBody, safeAiErrorResponse } from "@/shared/api/ai";
import { assertTrustedMutationRequest, createRequestClient, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";
import { GOOGLE_MEDIA_MODELS, downloadGoogleVideo, pollGoogleVideo, startGoogleVideo } from "@/shared/api/ai/google/media";
import { signVideoOperation, verifyVideoOperation } from "@/shared/api/ai/google/video-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ prompt: z.string().trim().min(10).max(1200), aspectRatio: z.enum(["16:9", "9:16"]).default("9:16") }).strict();
function config() {
  if (process.env.APP_RUNTIME_MODE === "mock" || process.env.AI_PROVIDER === "mock") throw new AiConfigurationError("Video generation needs a real Google provider.");
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiConfigurationError("GOOGLE_GENERATIVE_AI_API_KEY is required.");
  const model = process.env.AI_VIDEO_MODEL?.trim() || GOOGLE_MEDIA_MODELS.video;
  if (!["veo-3.1-fast-generate-preview", "veo-3.1-lite-generate-preview", "veo-3.1-generate-preview"].includes(model)) throw new AiConfigurationError("AI_VIDEO_MODEL is invalid.");
  return { apiKey, model };
}
function errorResponse(error: unknown, id: string) {
  return error instanceof SupabaseHttpError ? safeSupabaseErrorResponse(error, id) : safeAiErrorResponse(error, id);
}
export async function POST(request: Request) {
  const id = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const user = await requireAuthenticatedUser(await createRequestClient());
    const limited = enforceAiRateLimit(request, id, { operation: "video", authenticatedUserId: user.id, limit: 3, windowMs: 60_000 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, schema, id, 8192);
    if (!parsed.ok) return parsed.response;
    const settings = config();
    const operation = await startGoogleVideo(settings, { ...parsed.data, model: settings.model, signal: request.signal });
    const token = signVideoOperation({ operation, ownerId: user.id, expiresAt: Date.now() + 60 * 60_000 }, settings.apiKey);
    return jsonSuccessResponse(id, { operationToken: token, status: "pending", modelId: settings.model, pollAfterMs: 10_000 });
  } catch (error) { return errorResponse(error, id); }
}
export async function GET(request: Request) {
  const id = createRequestId();
  try {
    const user = await requireAuthenticatedUser(await createRequestClient());
    const limited = enforceAiRateLimit(request, id, { operation: "video-poll", authenticatedUserId: user.id, limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const settings = config();
    const operation = verifyVideoOperation(token, user.id, Date.now(), settings.apiKey);
    if (!operation) throw new AiHttpError(403, "VIDEO_OPERATION_FORBIDDEN", "The video request is unavailable or expired.");
    const result = await pollGoogleVideo(settings, operation, request.signal);
    if (!result.done) return jsonSuccessResponse(id, { status: "pending", pollAfterMs: 10_000 });
    // Keep the provider key and download URI on the server. Never fetch a browser URL.
    const response = await downloadGoogleVideo(settings, result.uri, request.signal);
    return new Response(response.body, { headers: { "Content-Type": "video/mp4", "Cache-Control": "private, no-store", "X-Request-Id": id, "X-AI-Provider": "google" } });
  } catch (error) { return errorResponse(error, id); }
}
