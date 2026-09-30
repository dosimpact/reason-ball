import { restoreMissionAssistance } from "@/entities/mission-run/model/mission-hint";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EvaluationAxis,
  MissionCompletionResult,
  MissionEvaluation,
  MissionRun,
  MissionRunBest,
  MissionRunStep,
} from "@/entities/mission-run/model/types";
import { assertDatabaseSuccess, SupabaseHttpError, throwMutationError } from "@/shared/api/supabase/http";
import { resumeOwnedRun } from "./resume-owned-run";
import { restoreMissionDisplayMetadata } from "@/shared/api/supabase/version-display-metadata";
import { restoreNewExpressions } from "@/entities/mission-run/model/new-expressions";
import { restoreEvaluationObjectiveIds } from "@/entities/mission-run/model/evaluation-objectives";

export async function startProductionRun(
  admin: SupabaseClient,
  input: {
    ownerId: string;
    mission: { id: string; versionId: string };
    character: { id: string; versionId: string };
    conversationId?: string;
    modelId?: string;
  },
) {
  const result = await admin.rpc("start_mission_run", {
    _expected_owner_id: input.ownerId,
    _mission_id: input.mission.id,
    _mission_version_id: input.mission.versionId,
    _character_id: input.character.id,
    _character_version_id: input.character.versionId,
    _conversation_id: input.conversationId ?? null,
    _model_id: input.modelId ?? "gpt-5.6-terra",
  });
  if (result.error) {
    const errors: Record<string, [string, string]> = {
      P2002: ["CONVERSATION_CONTEXT_MISMATCH", "The conversation does not match this mission and character."],
      P2003: ["MISSION_CHARACTER_NOT_ALLOWED", "This character is not available for the selected mission."],
      P2004: ["MISSION_STEPS_REQUIRED", "The mission has no learning steps."],
      P2005: ["MISSION_START_UNAVAILABLE", "This mission or character is not available for a new run."],
      "40P01": ["MISSION_START_CONFLICT", "Mission start conflicted with another update. Please retry."],
    };
    const mapped = errors[result.error.code];
    if (mapped) throw new SupabaseHttpError(409, mapped[0], mapped[1], result.error.code === "40P01");
    throwMutationError(result.error, "mission_runs.start");
  }
  if (typeof result.data !== "string") {
    throw new SupabaseHttpError(502, "MISSION_START_EMPTY_RESULT", "The data service returned no mission run.", true);
  }
  return result.data;
}

export async function findOwnedRunToResume(
  client: SupabaseClient,
  admin: SupabaseClient,
  input: { ownerId: string; conversationId?: string; missionId: string; characterId: string },
) {
  const result = await resumeOwnedRun<MissionRunRow>(input, {
    async conversation(id, ownerId) {
      const result = await client.from("conversations")
        .select("id, owner_id, status, mission_id, mission_version_id, character_id, character_version_id")
        .eq("id", id).eq("owner_id", ownerId).limit(1);
      assertDatabaseSuccess(result.error, "conversations.resume_owned");
      return result.data?.[0];
    },
    async run(id, ownerId) {
      const result = await client.from("mission_runs")
        .select("id, owner_id, mission_id, mission_version_id, character_id, character_version_id, conversation_id, status, current_step_order, attempt_number, score, stars, turn_count, awarded_mission_reward_id, awarded_evaluation_id, started_at, completed_at")
        .eq("conversation_id", id).eq("owner_id", ownerId).limit(1);
      assertDatabaseSuccess(result.error, "mission_runs.resume_owned");
      return result.data?.[0] as MissionRunRow | undefined;
    },
    async slug(table, id) {
      const result = await admin.from(table).select("slug").eq("id", id).limit(1);
      assertDatabaseSuccess(result.error, "mission_runs.resume_alias");
      return result.data?.[0]?.slug;
    },
  });
  if (result.kind === "conflict") {
    throw new SupabaseHttpError(409, "CONVERSATION_CONTEXT_MISMATCH", "The conversation does not match this mission and character.");
  }
  return result.kind === "resume" ? result.run : undefined;
}

export type MissionRunRow = {
  id: string;
  owner_id: string;
  mission_id: string;
  mission_version_id: string;
  character_id: string;
  character_version_id: string;
  conversation_id: string;
  status: MissionRun["status"];
  current_step_order: number;
  attempt_number: number;
  score: number | string | null;
  stars: number | null;
  turn_count: number;
  awarded_mission_reward_id: string | null;
  awarded_evaluation_id: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type StepRow = {
  mission_step_id: string;
  status: MissionRunStep["status"];
  attempts: number;
  evidence_message_ids: string[];
  score: number | string | null;
  feedback: string | null;
};

type StepDefinitionRow = {
  id: string;
  title: string;
  step_order: number;
  is_optional: boolean;
};

type EvaluationRow = {
  id: string;
  status: string;
  total_score: number | string | null;
  passed: boolean | null;
  rubric_scores: unknown;
  feedback: unknown;
  corrections: unknown;
  vocabulary_observed: unknown;
  created_at: string;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function axesFromRubric(value: unknown): EvaluationAxis[] {
  const rubric = record(value);
  const configured = Array.isArray(rubric.axes) ? rubric.axes : [];
  if (configured.length > 0) return configured as EvaluationAxis[];
  return [
    ["taskCompletion", "과업 완수", rubric.taskCompletion],
    ["appropriateness", "상황 적절성", rubric.appropriateness],
    ["grammar", "문법·명료성", rubric.grammar],
    ["vocabulary", "어휘 활용", rubric.vocabulary],
  ].map(([key, label, score]) => ({
    key: key as EvaluationAxis["key"],
    label: label as string,
    score: numberValue(score),
    evidence: [],
  }));
}

function evaluationFromRow(
  row: EvaluationRow,
  runId: string,
  completedStepIds: string[],
  stars: number,
): MissionEvaluation {
  const feedback = record(row.feedback);
  return {
    id: row.id,
    runId,
    status: "completed",
    passed: row.passed ?? false,
    totalScore: numberValue(row.total_score),
    stars,
    axes: axesFromRubric(row.rubric_scores),
    summary: typeof feedback.summary === "string" ? feedback.summary : "평가가 완료되었어요.",
    strengths: strings(feedback.strengths),
    improvements: strings(feedback.improvements),
    corrections: Array.isArray(row.corrections)
      ? (row.corrections as MissionEvaluation["corrections"])
      : [],
    completedStepIds,
    vocabularyObserved: strings(row.vocabulary_observed),
    newExpressions: restoreNewExpressions(row.feedback),
    assistance: restoreMissionAssistance(row.feedback),
    createdAt: row.created_at,
  };
}

export async function getOwnedRunRow(
  client: SupabaseClient,
  ownerId: string,
  runId: string,
) {
  const result = await client
    .from("mission_runs")
    .select("id, owner_id, mission_id, mission_version_id, character_id, character_version_id, conversation_id, status, current_step_order, attempt_number, score, stars, turn_count, awarded_mission_reward_id, awarded_evaluation_id, started_at, completed_at")
    .eq("id", runId)
    .eq("owner_id", ownerId)
    .limit(1);
  assertDatabaseSuccess(result.error, "mission_runs.select_owned");
  const row = ((result.data ?? []) as MissionRunRow[])[0];
  if (!row) {
    throw new SupabaseHttpError(404, "MISSION_RUN_NOT_FOUND", "The mission run could not be found.");
  }
  return row;
}

async function restoreProductionCompletion(
  client: SupabaseClient,
  row: MissionRunRow,
): Promise<MissionCompletionResult | undefined> {
  if (row.status !== "passed") return undefined;
  if (!row.awarded_evaluation_id || !row.awarded_mission_reward_id || !row.completed_at || row.score == null || row.stars == null) {
    throw new SupabaseHttpError(502, "MISSION_COMPLETION_INCOMPLETE", "The saved completion is missing its awarded result.");
  }
  const [reward, mission] = await Promise.all([
    client.from("mission_rewards").select("character_asset_id")
      .eq("id", row.awarded_mission_reward_id).eq("mission_id", row.mission_id).eq("mission_version_id", row.mission_version_id).single(),
    client.from("missions").select("reward_experience_points").eq("id", row.mission_id).single(),
  ]);
  assertDatabaseSuccess(reward.error, "mission_rewards.restore_completion");
  assertDatabaseSuccess(mission.error, "missions.restore_completion_xp");
  if (!reward.data || !mission.data || !Number.isInteger(mission.data.reward_experience_points) || mission.data.reward_experience_points < 0) {
    throw new SupabaseHttpError(502, "MISSION_COMPLETION_INCOMPLETE", "The saved completion reward is unavailable.");
  }
  // The same asset can already have been unlocked by an earlier attempt.
  // Match the completion RPC's owner+asset identity, not the current run ID.
  const unlock = await client.from("reward_unlocks").select("id")
    .eq("user_id", row.owner_id).eq("character_asset_id", reward.data.character_asset_id).single();
  assertDatabaseSuccess(unlock.error, "reward_unlocks.restore_completion");
  if (!unlock.data) throw new SupabaseHttpError(502, "MISSION_COMPLETION_INCOMPLETE", "The saved reward unlock is unavailable.");
  return {
    missionRunId: row.id,
    missionEvaluationId: row.awarded_evaluation_id,
    rewardUnlockId: unlock.data.id,
    score: numberValue(row.score),
    stars: row.stars,
    // Matches complete_mission_run replay. The schema has no immutable per-run
    // XP snapshot; this value is the mission's current configured award.
    experiencePointsAwarded: mission.data.reward_experience_points,
    alreadyCompleted: true,
  };
}

export async function hydrateProductionRun(
  client: SupabaseClient,
  row: MissionRunRow,
  completion?: MissionCompletionResult,
): Promise<MissionRun> {
  const [stepResult, definitionResult, evaluationResult, missionResult, bestResult, displayResult, restoredCompletion] =
    await Promise.all([
      client
        .from("mission_step_progress")
        .select("mission_step_id, status, attempts, evidence_message_ids, score, feedback")
        .eq("mission_run_id", row.id),
      client
        .from("mission_steps")
        .select("id, title, step_order, is_optional")
        .eq("mission_version_id", row.mission_version_id)
        .order("step_order", { ascending: true }),
      client
        .from("mission_evaluations")
        .select("id, status, total_score, passed, rubric_scores, feedback, corrections, vocabulary_observed, created_at")
        .eq("mission_run_id", row.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1),
      client
        .from("missions")
        .select("title, summary, scenario_category, difficulty, estimated_minutes")
        .eq("id", row.mission_id)
        .limit(1),
      client
        .from("mission_runs")
        .select("attempt_number, score, stars, completed_at")
        .eq("owner_id", row.owner_id)
        .eq("mission_id", row.mission_id)
        .not("score", "is", null)
        .order("score", { ascending: false })
        .limit(1),
      client.from("mission_versions").select("display_metadata")
        .eq("id", row.mission_version_id).eq("mission_id", row.mission_id).limit(1),
      completion ? Promise.resolve(completion) : restoreProductionCompletion(client, row),
    ]);
  assertDatabaseSuccess(stepResult.error, "mission_step_progress.select");
  assertDatabaseSuccess(definitionResult.error, "mission_steps.select");
  assertDatabaseSuccess(evaluationResult.error, "mission_evaluations.select");
  assertDatabaseSuccess(missionResult.error, "missions.run_title");
  assertDatabaseSuccess(bestResult.error, "mission_runs.best");
  assertDatabaseSuccess(displayResult.error, "mission_versions.run_display");
  const missionBase = missionResult.data?.[0] as { title: string; summary: string; scenario_category: string; difficulty: string; estimated_minutes: number } | undefined;
  const display = missionBase ? restoreMissionDisplayMetadata(missionBase, displayResult.data?.[0]?.display_metadata) : undefined;

  const progress = new Map(
    ((stepResult.data ?? []) as StepRow[]).map((step) => [step.mission_step_id, step]),
  );
  const steps = ((definitionResult.data ?? []) as StepDefinitionRow[]).map((definition) => {
    const item = progress.get(definition.id);
    return {
      id: definition.id,
      label: definition.title,
      required: !definition.is_optional,
      order: definition.step_order,
      status: item?.status ?? "locked",
      attempts: item?.attempts ?? 0,
      evidenceMessageIds: item?.evidence_message_ids ?? [],
      score: item?.score == null ? undefined : numberValue(item.score),
      feedback: item?.feedback ?? undefined,
    } satisfies MissionRunStep;
  });
  const evaluationRow = ((evaluationResult.data ?? []) as EvaluationRow[])[0];
  const completedStepIds = restoreEvaluationObjectiveIds(evaluationRow?.feedback, steps.map((step) => step.id));
  const bestRow = ((bestResult.data ?? []) as Array<{
    attempt_number: number;
    score: number | string;
    stars: number | null;
    completed_at: string | null;
  }>)[0];
  const best: MissionRunBest | undefined = bestRow
    ? {
        attemptNumber: bestRow.attempt_number,
        score: numberValue(bestRow.score),
        stars: bestRow.stars ?? 0,
        completedAt: bestRow.completed_at ?? undefined,
      }
    : undefined;
  const feedback = evaluationRow ? record(evaluationRow.feedback) : {};
  return {
    id: row.id,
    missionId: row.mission_id,
    missionTitle:
      display?.title ?? "영어 회화 미션",
    missionVersionId: row.mission_version_id,
    characterId: row.character_id,
    characterVersionId: row.character_version_id,
    conversationId: row.conversation_id,
    status: row.status,
    currentStepOrder: row.current_step_order,
    attemptNumber: row.attempt_number,
    turnCount: row.turn_count,
    score: row.score == null ? undefined : numberValue(row.score),
    stars: row.stars ?? undefined,
    steps,
    evaluation: evaluationRow
      ? evaluationFromRow(evaluationRow, row.id, completedStepIds, row.stars ?? 0)
      : undefined,
    completion: restoredCompletion,
    rewardId: row.awarded_mission_reward_id ?? undefined,
    best,
    reviewNote: typeof feedback.reviewNote === "string" ? feedback.reviewNote : undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}
