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
import { gatePersistedStream } from "./_lib/persisted-stream";
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
  description: "Get deterministic weather context for an English role-play location.",
  inputSchema: z.object({
    location: z.string().trim().min(2).max(80),
  }),
  needsApproval: true,
  execute: async ({ location }) => {
    const score = Array.from(location).reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const conditions = ["sunny", "cloudy", "light rain", "windy"] as const;
    return {
      location,
      temperature: 14 + (score % 15),
      condition: conditions[score % conditions.length],
      source: process.env.APP_RUNTIME_MODE === "mock" ? "mock" : "provider",
    };
  },
});

function requireSupportedInput(capabilities: ModelCapabilities, messages: UIMessage[]) {
  const unsupported = unsupportedChatInput(capabilities, messages);
  if (unsupported) throw new AiHttpError(400, 'MODEL_CAPABILITY_REQUIRED', `Choose a model with confirmed ${unsupported} support for this conversation.`);
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  let generation: ChatGeneration | undefined;

  try {
    assertTrustedMutationRequest(request);
    const rateLimited = enforceAiRateLimit(request, requestId, {
      operation: "chat",
      limit: 60,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
    const parsed = await parseJsonBody(
      request,
      chatRequestSchema,
      requestId,
    );
    if (!parsed.ok) {
      return parsed.response;
    }

    const mockRuntime = process.env.APP_RUNTIME_MODE === "mock";
    if (!mockRuntime && (!parsed.data.conversationId || parsed.data.character || parsed.data.mission || parsed.data.scenario || parsed.data.learnerPreferences !== undefined)) {
      throw new AiHttpError(400, "SERVER_CONTEXT_REQUIRED", "Provide a conversation ID. Character, mission, and scenario context cannot be supplied by the client.");
    }
    const authorized = mockRuntime ? undefined : await loadAuthorizedChatContext(parsed.data.conversationId!);
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
      if (userLimit) return userLimit;
    }

    const capabilities = createAiCapabilities({
      operation: "chat",
      scenario: parsed.data.scenario,
      modelId: parsed.data.modelId,
    });

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

    const result = streamText({
      model: capabilities.languageModel,
      instructions: `${buildChatInstructions({
        character: parsed.data.character,
        mission: parsed.data.mission,
        scenario: parsed.data.scenario,
        publishedSnapshots: authorized?.snapshots,
      })}${learningPreferenceInstructions(learnerSettings)}${selectedModel.capabilities.tools === true ? '\nWhen weather context is requested, call the weather tool. Never retry a tool that the learner denied.' : '\nNo tools are available. Do not claim to have called an external tool.'}`,
      messages: modelMessages,
      tools: selectedModel.capabilities.tools === true ? { weather } : undefined,
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
      onFinish: ({ usage }) => {
        recordAiObservation({
          requestId,
          operation: "chat",
          provider: capabilities.providerName,
          model: capabilities.modelIds.chat,
          outcome: request.signal.aborted ? "aborted" : "success",
          startedAt,
          usage,
        });
      },
    });

    const stream = toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: generation ? () => generation!.assistantMessageId : undefined,
      onEnd: generation ? async ({ responseMessage, outcome, isAborted, finishReason }) => {
        await finishChatGeneration(generation!, {
          status: isAborted || outcome.status === "aborted" ? "cancelled" : outcome.status === "completed" ? "complete" : "error",
          parts: responseMessage.parts,
          finishReason,
        });
      } : undefined,
      onError: () => "The AI response could not be completed. Please retry.",
    });

    return createUIMessageStreamResponse({
      stream: generation ? gatePersistedStream(stream) : stream,
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
        await finishChatGeneration(generation, { status: request.signal.aborted ? "cancelled" : "error", parts: [] });
      } catch {
        // The lease allows safe recovery if storage itself is unavailable.
        // Never include database diagnostics or conversation content in the response.
      }
    }
    if (error instanceof SupabaseHttpError) return safeSupabaseErrorResponse(error, requestId);
    return safeAiErrorResponse(error, requestId);
  }
}
