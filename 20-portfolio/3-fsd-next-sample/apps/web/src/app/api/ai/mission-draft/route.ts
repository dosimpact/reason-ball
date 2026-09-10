import { generateText, Output } from "ai";

import {
  AiHttpError,
  createAiCapabilities,
  createRequestId,
  enforceAiRateLimit,
  jsonSuccessResponse,
  MISSION_DRAFT_INSTRUCTIONS,
  missionDraftRequestSchema,
  missionDraftSchema,
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
      operation: "mission-draft",
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
    const parsed = await parseJsonBody(
      request,
      missionDraftRequestSchema,
      requestId,
      32 * 1024,
    );
    if (!parsed.ok) {
      return parsed.response;
    }

    const capabilities = createAiCapabilities({
      operation: "mission-draft",
      scenario: parsed.data.scenario,
    });

    if (parsed.data.scenario && capabilities.providerName !== "mock") {
      throw new AiHttpError(
        400,
        "SCENARIO_NOT_ALLOWED",
        "A mock scenario can only be used in mock runtime mode.",
      );
    }

    const result = await generateText({
      model: capabilities.languageModel,
      instructions: MISSION_DRAFT_INSTRUCTIONS,
      prompt: JSON.stringify({
        topic: parsed.data.topic,
        level: parsed.data.level,
        durationMinutes: parsed.data.durationMinutes,
        place: parsed.data.place,
        learnerRole: parsed.data.learnerRole,
        characterRole: parsed.data.characterRole,
      }),
      output: Output.object({
        schema: missionDraftSchema,
        name: "english_conversation_mission_draft",
        description:
          "A creator-editable, beginner-friendly real-life English conversation mission",
      }),
      abortSignal: request.signal,
      maxRetries: 1,
      timeout: { totalMs: 45_000, stepMs: 45_000 },
      providerOptions:
        capabilities.providerName === "mock"
          ? undefined
          : { openai: { store: false } },
    });

    const draft = missionDraftSchema.parse(result.output);
    const response = jsonSuccessResponse(requestId, draft, {
      "X-AI-Model": capabilities.modelIds.chat,
      "X-AI-Provider": capabilities.providerName,
    });
    recordAiObservation({ requestId, operation: "mission-draft", provider: capabilities.providerName, model: capabilities.modelIds.chat, outcome: "success", startedAt, usage: result.usage });
    return response;
  } catch (error) {
    return safeAiErrorResponse(error, requestId);
  }
}
