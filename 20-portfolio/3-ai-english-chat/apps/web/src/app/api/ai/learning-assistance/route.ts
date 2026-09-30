import { generateText, Output } from "ai";
import { z } from "zod";
import { assistanceInstructions, assistanceRequestSchema, assistanceGenerationSchema, buildAssistancePrompt, selectAssistanceContext } from "@/entities/learning-assistance/model/assistance";
import { loadAssistanceMessages } from "@/entities/learning-assistance/api/server-context";
import { loadLearningPreferences } from "@/entities/learner/api/server-preferences";
import { AiHttpError, createAiCapabilities, createRequestId, enforceAiRateLimit, jsonSuccessResponse, parseJsonBody, recordAiObservation, safeAiErrorResponse } from "@/shared/api/ai";
import { assertTrustedMutationRequest, createRequestClient, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  try {
    assertTrustedMutationRequest(request);
    const limited = enforceAiRateLimit(request, requestId, { operation: "learning-assistance", limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, assistanceRequestSchema, requestId, 160 * 1024);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const mock = process.env.APP_RUNTIME_MODE === "mock";
    if (!mock && (input.demo || !z.uuid().safeParse(input.conversationId).success || !z.uuid().safeParse(input.messageId).success)) throw new AiHttpError(400, "SERVER_CONTEXT_REQUIRED", "대화와 메시지 UUID만 전달해 주세요.");
    let messages;
    let level: string;
    if (mock) {
      if (!input.demo) throw new AiHttpError(400, "DEMO_CONTEXT_REQUIRED", "데모 대화 정보가 필요합니다.");
      messages = input.demo.messages;
      level = input.demo.level;
    } else {
      const client = await createRequestClient();
      const user = await requireAuthenticatedUser(client);
      const userLimit = enforceAiRateLimit(request, requestId, { operation: "learning-assistance-user", authenticatedUserId: user.id, limit: 20, windowMs: 60_000 });
      if (userLimit) return userLimit;
      messages = await loadAssistanceMessages(client, user.id, input);
      level = (await loadLearningPreferences(client, user.id)).settings.learnerLevel;
    }
    let context;
    try { context = selectAssistanceContext(messages, input.messageId, input.mode); }
    catch { throw new AiHttpError(400, "INVALID_ASSISTANCE_TARGET", "이 메시지에는 선택한 학습 도움을 제공할 수 없어요."); }
    const capabilities = createAiCapabilities({ operation: "learning-assistance" });
    const generated = await generateText({ model: capabilities.languageModel, instructions: assistanceInstructions, prompt: buildAssistancePrompt(input.mode, level, context), output: Output.object({ schema: assistanceGenerationSchema }),
      abortSignal: request.signal, maxRetries: 0, maxOutputTokens: 1200, timeout: { totalMs: 30_000, stepMs: 30_000 }, providerOptions: capabilities.providerName === "mock" ? undefined : { openai: { store: false } } });
    const result = assistanceGenerationSchema.parse(generated.output);
    recordAiObservation({ requestId, operation: "learning-assistance", startedAt, outcome: "success", provider: capabilities.providerName, model: capabilities.modelIds.chat, usage: generated.usage });
    return jsonSuccessResponse(requestId, { mode: input.mode, messageId: input.messageId, targetText: context.target.text, source: capabilities.providerName === "mock" ? "mock" : "provider", result });
  } catch (error) {
    recordAiObservation({ requestId, operation: "learning-assistance", startedAt, outcome: request.signal.aborted ? "aborted" : "error" });
    return error instanceof SupabaseHttpError ? safeSupabaseErrorResponse(error, requestId) : safeAiErrorResponse(error, requestId);
  }
}
