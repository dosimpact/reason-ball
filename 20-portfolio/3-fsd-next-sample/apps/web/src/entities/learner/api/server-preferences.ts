import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDatabaseSuccess, throwMutationError } from "@/shared/api/supabase/http";
import { defaultPreferences, preferenceRecordSchema, type LearningPreferences } from "../model/preferences";

export async function loadLearningPreferences(client: SupabaseClient, ownerId: string) {
  const result = await client.from("learner_preferences").select("revision, settings").eq("user_id", ownerId).maybeSingle();
  assertDatabaseSuccess(result.error, "learner_preferences.read");
  return preferenceRecordSchema.parse({ ownerId, revision: result.data?.revision ?? 0, settings: result.data?.settings ?? { ...defaultPreferences, displayName: "학습자" } });
}

export async function saveLearningPreferences(client: SupabaseClient, ownerId: string, expectedRevision: number, settings: LearningPreferences) {
  const result = await client.rpc("save_learning_preferences", { _expected_revision: expectedRevision, _settings: settings });
  if (result.error) throwMutationError(result.error, "learner_preferences.save");
  const row = result.data?.[0];
  return preferenceRecordSchema.parse({ ownerId, revision: row?.revision, settings: row?.settings });
}
