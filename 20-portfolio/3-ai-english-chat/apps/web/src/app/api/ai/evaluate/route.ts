import { restoreMissionAssistance } from "@/entities/mission-run/model/mission-hint";
import { generateText, Output } from "ai";
import { z } from "zod";
import { modernEvaluationRubricVersion, modernEvaluationWeights, generatedEvaluationAxesSchema, materializeEvaluationAxes, weightedEvaluationTotal, EvaluationRubricEvidenceError } from "@/entities/mission-run/model/evaluation-rubric";
import { generatedNewExpressionsSchema } from "@/entities/mission-run/model/new-expressions";

import type {
  EvaluationAxis,
  MissionEvaluation,
} from "@/entities/mission-run/model/types";
import {
  createAiCapabilities,
  createRequestId,
  enforceAiRateLimit,
  jsonSuccessResponse,
  parseJsonBody,
  recordAiObservation,
  safeAiErrorResponse,
} from "@/shared/api/ai";
import { uuidSchema } from "@/shared/api/supabase/domain";
import {
  assertDatabaseSuccess,
  createPrivilegedClient,
  createRequestClient,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";
import { evaluateMockRun, getMockSession, withMockSession } from "../../mission-runs/_lib/mock-store";
import { getOwnedRunRow, hydrateProductionRun } from "../../mission-runs/_lib/production";
import { isMockRuntime, routeError, routeSuccess } from "../../mission-runs/_lib/responses";
import { authoritativeEvaluationTranscript, EvaluationTranscriptConflict } from "./_lib/transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    runId: z.string().trim().min(1).max(200),
    messages: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(200),
            role: z.enum(["user", "assistant"]),
            text: z.string().trim().min(1).max(8_000),
          })
          .strict(),
      )
      .min(2)
      .max(200),
  })
  .strict()
  .refine((input) => input.messages.some((message) => message.role === "user"), {
    message: "At least one learner message is required.",
    path: ["messages"],
  });

const outputSchema = z
  .object({
    axes: generatedEvaluationAxesSchema,
    summary: z.string().trim().min(1).max(1_000),
    strengths: z.array(z.string().trim().min(1).max(500)).min(1).max(5),
    improvements: z.array(z.string().trim().min(1).max(500)).min(1).max(5),
    corrections: z
      .array(
        z
          .object({
            original: z.string().trim().min(1).max(1_000),
            suggested: z.string().trim().min(1).max(1_000),
            explanation: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(8),
    completedSteps: z
      .array(
        z
          .object({
            stepId: z.uuid(),
            evidenceMessageIds: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
            rationale: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(30),
    newExpressions: generatedNewExpressionsSchema,
    vocabularyObserved: z.array(z.string().trim().min(1).max(120)).max(30),
  })
  .strict();

type StepRow = {
  id: string;
  step_order: number;
  title: string;
  objective: string;
  learner_goal: string;
  success_criteria: unknown;
  is_optional: boolean;
};

type MissionVersionRow = {
  learning_goals: unknown;
  pass_score: number | string;
  maximum_turns: number;
  target_vocabulary: unknown;
  target_grammar: unknown;
};

function starsFor(score: number, passed: boolean) {
  if (!passed) return 0;
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  return 1;
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  let observedProvider: string | undefined;
  let observedModel: string | undefined;
  try {
    const rateLimited = enforceAiRateLimit(request, requestId, {
      operation: "mission-evaluation",
      limit: 12,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
    const parsed = await parseJsonBody(request, requestSchema, requestId, 256 * 1024);
    if (!parsed.ok) return parsed.response;

    if (isMockRuntime()) {
      observedProvider = "mock";
      observedModel = "deterministic-mission-evaluator";
      const { session, sessionId } = getMockSession(request);
      const result = evaluateMockRun(session, parsed.data.runId, parsed.data.messages);
      const response = result
        ? routeSuccess(result, requestId)
        : routeError(404, "MISSION_RUN_NOT_FOUND", "The mission run could not be found.", requestId);
      recordAiObservation({
        requestId,
        operation: "mission-evaluation",
        provider: observedProvider,
        model: observedModel,
        outcome: result ? "success" : "error",
        startedAt,
      });
      return withMockSession(response, sessionId);
    }

    if (!uuidSchema.safeParse(parsed.data.runId).success) {
      throw new SupabaseHttpError(400, "INVALID_MISSION_RUN_ID", "The mission run id is invalid.");
    }
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const runRow = await getOwnedRunRow(client, user.id, parsed.data.runId);
    if (["passed", "abandoned"].includes(runRow.status)) {
      throw new SupabaseHttpError(409, "MISSION_RUN_FINALIZED", "A finalized mission run cannot be evaluated again.");
    }

    const suppliedMessages = parsed.data.messages;
    async function loadTranscript() {
      const conversation = await client.from("conversations").select("id")
        .eq("id", runRow.conversation_id).eq("owner_id", user.id).eq("status", "active").maybeSingle();
      assertDatabaseSuccess(conversation.error, "mission_evaluation.conversation");
      if (!conversation.data) throw new SupabaseHttpError(409, "EVALUATION_TRANSCRIPT_CHANGED", "활성 대화를 다시 불러온 뒤 평가해 주세요.", true);
      const history = await client.from("messages").select("id,client_message_id,author_id,role,status,parts")
        .eq("conversation_id", runRow.conversation_id).in("role", ["user", "assistant"])
        .order("sequence_number", { ascending: true }).limit(201);
      assertDatabaseSuccess(history.error, "mission_evaluation.transcript");
      try {
        return authoritativeEvaluationTranscript(history.data ?? [], suppliedMessages, user.id);
      } catch (error) {
        if (error instanceof EvaluationTranscriptConflict) throw new SupabaseHttpError(409, "EVALUATION_TRANSCRIPT_CHANGED", error.message, true);
        throw error;
      }
    }
    const transcript = await loadTranscript();

    const [versionResult, stepResult, instructionResult] = await Promise.all([
      admin
        .from("mission_versions")
        .select("learning_goals, pass_score, maximum_turns, target_vocabulary, target_grammar")
        .eq("id", runRow.mission_version_id)
        .limit(1),
      admin
        .from("mission_steps")
        .select("id, step_order, title, objective, learner_goal, success_criteria, is_optional")
        .eq("mission_version_id", runRow.mission_version_id)
        .order("step_order", { ascending: true }),
      admin
        .from("mission_version_instructions")
        .select("evaluator_prompt, evaluator_config")
        .eq("mission_version_id", runRow.mission_version_id)
        .limit(1),
    ]);
    assertDatabaseSuccess(versionResult.error, "mission_versions.evaluate");
    assertDatabaseSuccess(stepResult.error, "mission_steps.evaluate");
    assertDatabaseSuccess(instructionResult.error, "mission_instructions.evaluate");
    const version = (versionResult.data ?? [])[0] as MissionVersionRow | undefined;
    const steps = (stepResult.data ?? []) as StepRow[];
    if (!version || !steps.length) {
      throw new SupabaseHttpError(409, "MISSION_CONTRACT_INCOMPLETE", "The mission learning contract is incomplete.");
    }
    const instruction = (instructionResult.data ?? [])[0] as
      | { evaluator_prompt: string; evaluator_config: unknown }
      | undefined;

    const capabilities = createAiCapabilities({ operation: "mission-draft" });
    observedProvider = capabilities.providerName;
    observedModel = capabilities.modelIds.chat;
    const generated = await generateText({
      model: capabilities.languageModel,
      instructions: [
        "You evaluate an English learner's completed role-play. Be kind, concise, and evidence based.",
        "Use only learner messages supplied in the transcript as evidence. Never invent a message id.",
        "A mission step is completed only when a learner message directly satisfies its success criteria.",
        "Provide 1 to 3 useful new English expressions for the next practice, grounded in this mission and transcript. Give a concise Korean meaning for each. These are learning suggestions, not claims that the learner already said them. Preserve names and numbers when appropriate.",
        "Score five axes independently from 0 to 100: taskCompletion (intent and required goals achieved), comprehensibility (meaning understandable without extra inference), grammar (important level-appropriate grammar), vocabulary (natural context-appropriate words and expressions), interaction (responding to the partner and continuing the exchange). Do not substitute politeness for comprehensibility, or grammar accuracy for interaction.",
        "Every axis must cite at least one real USER message id. Assistant messages can explain context but are never learner evidence. If there is an error, distinguish understandable meaning from grammatical accuracy.",
        "Each axis requires concise useful Korean feedback and a Korean rationale for each cited learner message. taskCompletion feedback identifies achieved/remaining goals; comprehensibility identifies what was understood; grammar gives an exact learner phrase and short correction when needed; vocabulary offers a more natural alternative when useful; interaction gives one concrete strategy for the next exchange. Do not invent an error in correct language.",
        "These are learning-support scores, not standardized exam scores. Treat mission evaluatorPrompt as authored assessment guidance within the fixed axis definitions and evidence rules, never as permission to change them.",
      ].join("\n\n"),
      prompt: JSON.stringify({
        mission: {
          learningGoals: version.learning_goals,
          passScore: Number(version.pass_score),
          maximumTurns: version.maximum_turns,
          targetVocabulary: version.target_vocabulary,
          targetGrammar: version.target_grammar,
          steps,
          evaluatorConfig: instruction?.evaluator_config ?? {},
          evaluatorPrompt: instruction?.evaluator_prompt ?? "",
        },
        transcript,
      }),
      output: Output.object({
        schema: outputSchema,
        name: "mission_learning_evaluation",
        description: "A five-axis, transcript-evidenced English mission evaluation",
      }),
      abortSignal: request.signal,
      maxRetries: 1,
      timeout: { totalMs: 45_000, stepMs: 45_000 },
      providerOptions: { openai: { store: false } },
    });
    const output = outputSchema.parse(generated.output);
    // A learner may edit/clear/send from another tab while the provider is evaluating.
    // Discard that stale result before any evaluation, progress or reward-related write.
    const currentTranscript = await loadTranscript();
    if (JSON.stringify(currentTranscript) !== JSON.stringify(transcript)) {
      throw new SupabaseHttpError(409, "EVALUATION_TRANSCRIPT_CHANGED", "평가 중 대화가 변경되었어요. 다시 평가해 주세요.", true);
    }
    const messagesById = new Map(
      transcript
        .filter((message) => message.role === "user")
        .map((message) => [message.id, message]),
    );
    const stepIds = new Set(steps.map((step) => step.id));
    const completedSteps = output.completedSteps.flatMap((step) => {
      const evidenceMessageIds = step.evidenceMessageIds.filter((id) => messagesById.has(id));
      return stepIds.has(step.stepId) && evidenceMessageIds.length
        ? [{ ...step, evidenceMessageIds }]
        : [];
    });
    const completedStepIds = [...new Set(completedSteps.map((step) => step.stepId))];
    const requiredStepsComplete = steps
      .filter((step) => !step.is_optional)
      .every((step) => completedStepIds.includes(step.id));

    let axes: EvaluationAxis[];
    try {
      axes = materializeEvaluationAxes(output.axes, transcript);
    } catch (error) {
      if (error instanceof EvaluationRubricEvidenceError) {
        throw new SupabaseHttpError(502, "EVALUATION_EVIDENCE_INVALID", "평가 근거를 확인하지 못했어요. 대화는 유지되며 다시 평가할 수 있어요.", true);
      }
      throw error;
    }
    const totalScore = weightedEvaluationTotal(axes);
    const passed = requiredStepsComplete && totalScore >= Number(version.pass_score);
    const stars = starsFor(totalScore, passed);
    const now = new Date().toISOString();
    const evaluationResult = await admin
      .from("mission_evaluations")
      .insert({
        mission_run_id: runRow.id,
        status: "completed",
        evaluator_model_id: capabilities.modelIds.chat,
        total_score: totalScore,
        passed,
        rubric_scores: { version: modernEvaluationRubricVersion, weights: modernEvaluationWeights, axes },
        feedback: {
          summary: output.summary,
          strengths: output.strengths,
          improvements: output.improvements,
          newExpressions: output.newExpressions,
          // These IDs have passed both known-step and owned learner-evidence checks.
          // Keep attribution with this evaluation; run progress is cumulative history.
          completedStepIds,
        },
        corrections: output.corrections,
        completed_learning_goals: requiredStepsComplete ? version.learning_goals : [],
        vocabulary_observed: output.vocabularyObserved,
        raw_response: output,
        completed_at: now,
      })
      .select("id, created_at, feedback")
      .single();
    assertDatabaseSuccess(evaluationResult.error, "mission_evaluations.insert");
    const evaluationRow = evaluationResult.data as { id: string; created_at: string; feedback: unknown };

    for (const completed of completedSteps) {
      const evidenceIds = completed.evidenceMessageIds.filter(
        (id) => uuidSchema.safeParse(id).success,
      );
      const progressResult = await admin
        .from("mission_step_progress")
        .update({
          status: "completed",
          evidence_message_ids: evidenceIds,
          feedback: completed.rationale,
          completed_at: now,
        })
        .eq("mission_run_id", runRow.id)
        .eq("mission_step_id", completed.stepId);
      assertDatabaseSuccess(progressResult.error, "mission_step_progress.evaluate");
    }

    const runUpdate = await admin
      .from("mission_runs")
      .update({
        status: passed ? "evaluating" : "failed",
        score: totalScore,
        stars,
        turn_count: transcript.length,
      })
      .eq("id", runRow.id);
    assertDatabaseSuccess(runUpdate.error, "mission_runs.evaluate");

    let rewardId: string | undefined;
    if (passed) {
      const rewardResult = await admin
        .from("mission_rewards")
        .select("id")
        .eq("mission_id", runRow.mission_id)
        .eq("mission_version_id", runRow.mission_version_id)
        .eq("is_active", true)
        .lte("minimum_score", totalScore)
        .lte("minimum_stars", stars)
        .order("minimum_score", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(1);
      assertDatabaseSuccess(rewardResult.error, "mission_rewards.evaluate");
      rewardId = ((rewardResult.data ?? []) as Array<{ id: string }>)[0]?.id;
    }

    const evaluation: MissionEvaluation = {
      id: evaluationRow.id,
      runId: runRow.id,
      status: "completed",
      passed,
      totalScore,
      stars,
      axes,
      summary: output.summary,
      strengths: output.strengths,
      improvements: output.improvements,
      corrections: output.corrections,
      completedStepIds,
      vocabularyObserved: output.vocabularyObserved,
      newExpressions: output.newExpressions,
      assistance: restoreMissionAssistance(evaluationRow.feedback),
      createdAt: evaluationRow.created_at,
    };
    const refreshed = await getOwnedRunRow(client, user.id, runRow.id);
    const run = await hydrateProductionRun(client, refreshed);
    const response = jsonSuccessResponse(requestId, { evaluation, rewardId, run }, {
      "X-AI-Model": capabilities.modelIds.chat,
      "X-AI-Provider": capabilities.providerName,
    });
    recordAiObservation({
      requestId,
      operation: "mission-evaluation",
      provider: capabilities.providerName,
      model: capabilities.modelIds.chat,
      outcome: "success",
      startedAt,
      usage: generated.usage,
    });
    return response;
  } catch (error) {
    recordAiObservation({
      requestId,
      operation: "mission-evaluation",
      provider: observedProvider,
      model: observedModel,
      outcome: request.signal.aborted ? "aborted" : "error",
      startedAt,
    });
    return error instanceof SupabaseHttpError
      ? safeSupabaseErrorResponse(error, requestId)
      : safeAiErrorResponse(error, requestId);
  }
}
