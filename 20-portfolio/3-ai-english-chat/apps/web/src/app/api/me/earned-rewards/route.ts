import { z } from "zod";
import { assertDatabaseSuccess, createPrivilegedClient, createRequestClient, createRequestId, jsonSuccessResponse, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const displayTitle = z.object({ schemaVersion: z.literal(1), title: z.string().min(1).max(120) });

export async function GET() {
  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const unlocks: Array<{ id: string; mission_id: string; mission_reward_id: string; character_asset_id: string; unlocked_at: string }> = [];
    // Enumerate only this authenticated owner's earned records before privileged
    // lookups. Discovery visibility is not a prerequisite for keeping a reward.
    for (let offset = 0; ; offset += 100) {
      const result = await client.from("reward_unlocks")
        .select("id,mission_id,mission_reward_id,character_asset_id,unlocked_at")
        .eq("user_id", user.id).order("unlocked_at", { ascending: false }).order("id").range(offset, offset + 99);
      assertDatabaseSuccess(result.error, "reward_unlocks.collection_owned");
      unlocks.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 100) break;
    }
    // Input is newest-first. Keep the first entry for each mission without
    // reversing the insertion order of the resulting collection.
    const latestByMission = new Map<string, (typeof unlocks)[number]>();
    for (const unlock of unlocks) {
      if (!latestByMission.has(unlock.mission_id)) latestByMission.set(unlock.mission_id, unlock);
    }
    const latest = [...latestByMission.values()];
    const admin = createPrivilegedClient();
    const rewards = new Map<string, { id: string; mission_id: string; character_asset_id: string; mission_version_id: string }>();
    const rewardIds = [...new Set(latest.map(unlock => unlock.mission_reward_id))];
    for (let offset = 0; offset < rewardIds.length; offset += 100) {
      const result = await admin.from("mission_rewards")
        .select("id,mission_id,character_asset_id,mission_version_id")
        .in("id", rewardIds.slice(offset, offset + 100));
      assertDatabaseSuccess(result.error, "mission_rewards.collection_versions");
      for (const reward of result.data ?? []) rewards.set(reward.id, reward);
    }
    const referenced = latest.map(unlock => {
      const reward = rewards.get(unlock.mission_reward_id);
      if (!reward || reward.mission_id !== unlock.mission_id || reward.character_asset_id !== unlock.character_asset_id) {
        throw new SupabaseHttpError(502, "REWARD_REFERENCE_MISSING", "The earned reward's version is unavailable.");
      }
      return { unlock, versionId: reward.mission_version_id };
    });
    const versions = new Map<string, { id: string; mission_id: string; display_metadata: unknown }>();
    const versionIds = [...new Set(referenced.map(item => item.versionId))];
    // Two batched lookup passes, each with at most 100 IDs per request. Only
    // display metadata is read; private prompts and original paths stay out.
    for (let offset = 0; offset < versionIds.length; offset += 100) {
      const result = await admin.from("mission_versions").select("id,mission_id,display_metadata")
        .in("id", versionIds.slice(offset, offset + 100));
      assertDatabaseSuccess(result.error, "mission_versions.collection_displays");
      for (const version of result.data ?? []) versions.set(version.id, version);
    }
    const items = referenced.map(({ unlock, versionId }) => {
      const version = versions.get(versionId);
      if (!version || version.mission_id !== unlock.mission_id) {
        throw new SupabaseHttpError(502, "REWARD_REFERENCE_MISSING", "The earned reward's version is unavailable.");
      }
      const display = displayTitle.safeParse(version.display_metadata);
      return {
        id: unlock.mission_id, unlockId: unlock.id, unlockedAt: unlock.unlocked_at,
        title: display.success ? display.data.title : "완료한 미션",
        metadataSource: display.success ? "published-version" : "unavailable",
      };
    });
    return jsonSuccessResponse(requestId, { items });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
