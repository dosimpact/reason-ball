import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertDatabaseSuccess, SupabaseHttpError } from "./http";

type VersionedResource = {
  id: string;
  current_version_id: string | null;
  status: string;
};

async function publishedBase(
  admin: SupabaseClient,
  table: "characters" | "missions",
  id: string,
  allowArchived = false,
) {
  const result = await admin
    .from(table)
    .select("id, current_version_id, status")
    .eq("id", id)
    .in("status", allowArchived ? ["published", "archived"] : ["published"])
    .limit(1);
  assertDatabaseSuccess(result.error, `${table}.runtime_base`);
  const resource = (result.data ?? [])[0] as VersionedResource | undefined;
  if (!resource?.current_version_id) {
    throw new SupabaseHttpError(
      404,
      "PUBLISHED_RESOURCE_NOT_FOUND",
      "The published learning resource is unavailable.",
    );
  }
  return resource;
}

export async function loadPublishedCharacterRuntime(
  admin: SupabaseClient,
  input: { characterId: string; characterVersionId?: string; allowArchived?: boolean },
) {
  const character = await publishedBase(admin, "characters", input.characterId, Boolean(input.allowArchived && input.characterVersionId));
  const versionId = input.characterVersionId ?? character.current_version_id;
  const [versionResult, instructionResult] = await Promise.all([
    admin
      .from("character_versions")
      .select(
        "id, character_id, personality_summary, personality_traits, persona_goals, learning_goals, backstory, greeting, example_dialogues, voice_config, locale, published_at",
      )
      .eq("id", versionId)
      .eq("character_id", character.id)
      .not("published_at", "is", null)
      .limit(1),
    admin
      .from("character_version_instructions")
      .select("system_prompt, safety_instructions, conversation_rules, model_config")
      .eq("character_version_id", versionId)
      .limit(1),
  ]);
  assertDatabaseSuccess(versionResult.error, "character_versions.runtime");
  assertDatabaseSuccess(instructionResult.error, "character_instructions.runtime");
  const version = (versionResult.data ?? [])[0];
  const instructions = (instructionResult.data ?? [])[0];
  if (!version || !instructions) {
    throw new SupabaseHttpError(
      409,
      "PUBLISHED_VERSION_INCOMPLETE",
      "The immutable published character contract is incomplete.",
    );
  }
  return { characterId: character.id, characterVersionId: versionId, version, instructions };
}

export async function loadPublishedMissionRuntime(
  admin: SupabaseClient,
  input: { missionId: string; missionVersionId?: string; allowArchived?: boolean },
) {
  const mission = await publishedBase(admin, "missions", input.missionId, Boolean(input.allowArchived && input.missionVersionId));
  const versionId = input.missionVersionId ?? mission.current_version_id;
  const [versionResult, instructionResult, stepsResult, rewardsResult] =
    await Promise.all([
      admin
        .from("mission_versions")
        .select(
          "id, mission_id, learning_goals, scenario_context, learner_role, character_role, opening_instruction, target_vocabulary, target_grammar, pass_score, maximum_turns, locale, published_at",
        )
        .eq("id", versionId)
        .eq("mission_id", mission.id)
        .not("published_at", "is", null)
        .limit(1),
      admin
        .from("mission_version_instructions")
        .select("director_prompt, evaluator_prompt, safety_instructions, evaluator_config")
        .eq("mission_version_id", versionId)
        .limit(1),
      admin
        .from("mission_steps")
        .select(
          "id, step_order, title, objective, learner_goal, character_instruction, success_criteria, hints, vocabulary, is_optional",
        )
        .eq("mission_version_id", versionId)
        .order("step_order", { ascending: true }),
      admin
        .from("mission_rewards")
        .select("id, character_asset_id, minimum_score, minimum_stars, sort_order")
        .eq("mission_id", mission.id)
        .eq("mission_version_id", versionId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);
  assertDatabaseSuccess(versionResult.error, "mission_versions.runtime");
  assertDatabaseSuccess(instructionResult.error, "mission_instructions.runtime");
  assertDatabaseSuccess(stepsResult.error, "mission_steps.runtime");
  assertDatabaseSuccess(rewardsResult.error, "mission_rewards.runtime");
  const version = (versionResult.data ?? [])[0];
  const instructions = (instructionResult.data ?? [])[0];
  const steps = stepsResult.data ?? [];
  if (!version || !instructions || steps.length === 0) {
    throw new SupabaseHttpError(
      409,
      "PUBLISHED_VERSION_INCOMPLETE",
      "The immutable published mission contract is incomplete.",
    );
  }
  return {
    missionId: mission.id,
    missionVersionId: versionId,
    version,
    instructions,
    steps,
    rewards: rewardsResult.data ?? [],
  };
}
