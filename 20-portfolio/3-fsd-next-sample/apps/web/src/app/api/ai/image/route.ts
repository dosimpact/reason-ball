import { generateImage } from "ai";

import {
  createAiCapabilities,
  createRequestId,
  enforceAiRateLimit,
  imageRequestSchema,
  jsonSuccessResponse,
  parseJsonBody,
  recordAiObservation,
  safeAiErrorResponse,
} from "@/shared/api/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  try {
    const rateLimited = enforceAiRateLimit(request, requestId, {
      operation: "image",
      limit: 12,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
    const parsed = await parseJsonBody(
      request,
      imageRequestSchema,
      requestId,
      32 * 1024,
    );
    if (!parsed.ok) {
      return parsed.response;
    }

    const capabilities = createAiCapabilities({
      operation: "image",
      imageKind: parsed.data.kind,
    });
    const result = await generateImage({
      model: capabilities.imageModel,
      prompt: parsed.data.prompt,
      size: parsed.data.size,
      n: 1,
      abortSignal: request.signal,
      maxRetries: 1,
      providerOptions:
        capabilities.providerName === "mock"
          ? undefined
          : { openai: { quality: "medium" } },
    });

    const mediaType =
      capabilities.providerName === "mock"
        ? "image/svg+xml"
        : result.image.mediaType;

    const response = jsonSuccessResponse(
      requestId,
      {
        kind: parsed.data.kind,
        dataUrl: `data:${mediaType};base64,${result.image.base64}`,
        mediaType,
        modelId: capabilities.modelIds.image,
      },
      { "X-AI-Provider": capabilities.providerName },
    );
    recordAiObservation({ requestId, operation: "image", provider: capabilities.providerName, model: capabilities.modelIds.image, outcome: "success", startedAt, usage: result.usage });
    return response;
  } catch (error) {
    return safeAiErrorResponse(error, requestId);
  }
}
