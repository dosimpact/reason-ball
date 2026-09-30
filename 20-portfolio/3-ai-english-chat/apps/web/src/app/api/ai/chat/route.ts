import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { prepareChatGeneration, finishChatGeneration, type ChatGeneration } from "@/entities/chat/server";
import { trackMissionGoals } from "./_lib/mission-goal-tracking";
import { conversationReviewInstructions } from "./_lib/conversation-review";
import { gatePersistedStream } from "./_lib/persisted-stream";
import { createTerminalObservation } from "./_lib/terminal-observation";
import { hasAssistantOutput } from "./_lib/assistant-output";
import { getCurrentWeather } from "@/shared/api/ai/weather";
import { hydrateChatFiles } from '@/entities/chat/api/server-attachments';
import { readChatModelCatalog } from '@/shared/api/ai/config';
import { unsupportedChatInput, type ModelCapabilities } from '@/shared/api/ai/model-catalog';
import { loadAuthorizedChatContext } from "@/shared/api/supabase/chat-context";
import { assertTrustedMutationRequest, createRequestClient, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";
import { loadLearningPreferences } from "@/entities/learner/api/server-preferences";
import { defaultPreferences, learningPreferencesSchema, learningPreferenceInstructions } from "@/entities/learner/model/preferences";

import {
  AiHttpError,
  buildChatInstructions,
  chatRequestSchema,
  createAiCapabilities,
  createRequestId,
  enforceAiRateLimit,
  parseJsonBody,
  recordAiObservation,
  safeAiErrorResponse,
} from "@/shared/api/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const weather = tool({
  description: "Get current model-derived weather from Open-Meteo for a city.",
  inputSchema: z.object({
    location: z.string().trim().min(2).max(80),
  }),
  needsApproval: true,
  execute: ({ location }, { abortSignal }) => getCurrentWeather(location, abortSignal),
});

function requireSupportedInput(capabilities: ModelCapabilities, messages: UIMessage[]) {
  const unsupported = unsupportedChatInput(capabilities, messages);
  if (unsupported) throw new AiHttpError(400, 'MODEL_CAPABILITY_REQUIRED', `Choose a model with confirmed ${unsupported} support for this conversation.`);
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  let generation: ChatGeneration | undefined;
  let provider: string | undefined;
  let model: string | undefined;
  let usage: unknown;
  let authorizedConversationId: string | undefined;
  let providerFailed = false;
  let providerAborted = false;
  const observation = createTerminalObservation((outcome) => recordAiObservation({
    requestId, operation: "chat", provider, model, startedAt, outcome, usage,
    conversationId: generation?.conversationId ?? authorizedConversationId,
    assistantMessageId: generation?.assistantMessageId,
  }));

  try {
    assertTrustedMutationRequest(request);
    const rateLimited = enforceAiRateLimit(request, requestId, {
      operation: "chat",
      limit: 60,
      windowMs: 60_000,
    });
    if (rateLimited) { observation.record("error"); return rateLimited; }
    const parsed = await parseJsonBody(
      request,
      chatRequestSchema,
      requestId,
    );
    if (!parsed.ok) {
      observation.record("error");
      return parsed.response;
    }

    const mockRuntime = process.env.APP_RUNTIME_MODE === "mock";
    if (!mockRuntime && (!parsed.data.conversationId || parsed.data.character || parsed.data.mission || parsed.data.scenario || parsed.data.learnerPreferences !== undefined)) {
      throw new AiHttpError(400, "SERVER_CONTEXT_REQUIRED", "Provide a conversation ID. Character, mission, and scenario context cannot be supplied by the client.");
    }
    const authorized = mockRuntime ? undefined : await loadAuthorizedChatContext(parsed.data.conversationId!);
    if (authorized) authorizedConversationId = parsed.data.conversationId;
    const preferences = authorized
      ? (await loadLearningPreferences(await createRequestClient(), authorized.userId)).settings
      : learningPreferencesSchema.safeParse(parsed.data.learnerPreferences ?? defaultPreferences);
    if ("success" in preferences && !preferences.success) throw new AiHttpError(400, "INVALID_LEARNER_PREFERENCES", "Learning preferences are invalid.");
    const learnerSettings = "success" in preferences ? preferences.data : preferences;
    if (authorized) {
      const userLimit = enforceAiRateLimit(request, requestId, {
        operation: "chat-user",
        authenticatedUserId: authorized.userId,
        limit: 60,
        windowMs: 60_000,
      });
      if (userLimit) { observation.record("error"); return userLimit; }
    }

    const capabilities = createAiCapabilities({
      operation: "chat",
      scenario: parsed.data.scenario,
      modelId: parsed.data.modelId,
    });

    provider = capabilities.providerName;
    model = capabilities.modelIds.chat;

    if (parsed.data.scenario && capabilities.providerName !== "mock") {
      throw new AiHttpError(
        400,
        "SCENARIO_NOT_ALLOWED",
        "A mock scenario can only be used in mock runtime mode.",
      );
    }

    const selectedModel = readChatModelCatalog().items.find((entry) => entry.id === capabilities.modelIds.chat);
    if (!selectedModel) throw new AiHttpError(400, 'MODEL_NOT_ALLOWED', 'The requested AI model is not available.');
    requireSupportedInput(selectedModel.capabilities, parsed.data.messages as UIMessage[]);

    generation = authorized ? await prepareChatGeneration({
      conversationId: parsed.data.conversationId!,
      ownerId: authorized.userId,
      requestId,
      modelId: capabilities.modelIds.chat,
      messages: parsed.data.messages as UIMessage[],
    }) : undefined;
    const messages = generation?.messages ?? parsed.data.messages as UIMessage[];
    // Recheck authoritative history, not only the client-supplied latest turn.
    requireSupportedInput(selectedModel.capabilities, messages);
    let modelMessages;
    const providerMessages = authorized ? await hydrateChatFiles(messages, parsed.data.conversationId!, authorized.userId) : messages;
    try {
      modelMessages = await convertToModelMessages(providerMessages);
    } catch {
      throw new AiHttpError(
        400,
        "INVALID_MESSAGES",
        "The message history contains unsupported or incomplete parts.",
      );
    }

    const goalInstructions = generation && authorized?.snapshots.mission
      ? await trackMissionGoals(generation, capabilities.languageModel, request.signal) : "";
    const reviewInstructions = conversationReviewInstructions(messages, Boolean(authorized?.snapshots.mission ?? parsed.data.mission));
    const allowTools = selectedModel.capabilities.tools === true && !reviewInstructions;
    const result = streamText({
      model: capabilities.languageModel,
      instructions: `${buildChatInstructions({
        character: parsed.data.character,
        mission: parsed.data.mission,
        scenario: parsed.data.scenario,
        publishedSnapshots: authorized?.snapshots,
      })}${learningPreferenceInstructions(learnerSettings)}${goalInstructions}${reviewInstructions}${allowTools ? '\nWhen weather context is requested, call the weather tool. Never retry a tool that the learner denied.' : '\nNo tools are available. Do not claim to have called an external tool.'}`,
      messages: modelMessages,
      tools: allowTools ? { weather } : undefined,
      stopWhen: stepCountIs(5),
      abortSignal: request.signal,
      maxRetries: 1,
      timeout: {
        totalMs: 60_000,
        firstChunkMs: 15_000,
        chunkMs: 20_000,
      },
      providerOptions:
        capabilities.providerName === "mock"
          ? undefined
          : { openai: { store: false } },
      // SDK callbacks describe the model, not the persisted request outcome.
      onFinish: ({ usage: value }) => { usage = value; },
      onError: () => { providerFailed = true; },
      onAbort: () => { providerAborted = true; },
    });

    const stream = toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: generation ? () => generation!.assistantMessageId : undefined,
      onEnd: async ({ responseMessage, outcome, isAborted, finishReason }) => {
        const cancelled = request.signal.aborted || providerAborted || isAborted || outcome.status === "aborted";
        const emptyCompletion = !cancelled && outcome.status === "completed" && !hasAssistantOutput(responseMessage.parts);
        const status = cancelled ? "cancelled" : !providerFailed && outcome.status === "completed" && !emptyCompletion ? "complete" : "error";
        await observation.persist(status === "complete" ? "success" : status === "cancelled" ? "aborted" : "error", async () => {
          if (generation) await finishChatGeneration(generation, { status, parts: responseMessage.parts, finishReason });
        });
        if (emptyCompletion) throw new AiHttpError(502, "EMPTY_AI_RESPONSE", "The AI provider returned no response content. Please retry.");
      },
      onError: () => "The AI response could not be completed. Please retry.",
    });

    return createUIMessageStreamResponse({
      stream: gatePersistedStream(stream, () => observation.record("error")),
      headers: {
        "Cache-Control": "no-store",
        "X-AI-Provider": capabilities.providerName,
        "X-AI-Model": capabilities.modelIds.chat,
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (generation) {
      try {
        await observation.persist(request.signal.aborted ? "aborted" : "error", async () => {
          await finishChatGeneration(generation!, { status: request.signal.aborted ? "cancelled" : "error", parts: [] });
        });
      } catch {
        // The lease allows safe recovery if storage itself is unavailable.
        // Never include database diagnostics or conversation content in the response.
      }
    }
    observation.record(request.signal.aborted ? "aborted" : "error");
    if (error instanceof SupabaseHttpError) return safeSupabaseErrorResponse(error, requestId);
    return safeAiErrorResponse(error, requestId);
  }
}
