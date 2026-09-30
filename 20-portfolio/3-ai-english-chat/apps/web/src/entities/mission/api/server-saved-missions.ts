import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uuidSchema } from "@/shared/api/supabase/domain";
import { assertDatabaseSuccess, throwMutationError } from "@/shared/api/supabase/http";
import { savedMissionListSchema, savedMissionRequestSchema, savedMissionResultSchema, type SavedMissionItem } from "../model/saved-missions";

// Mutations use the canonical ID returned by mission detail/list. Resolving a
// slug before replay would fail after the mission becomes private or archived.
export const remoteSavedMissionRequestSchema = savedMissionRequestSchema.extend({ missionId: uuidSchema });

export async function loadSavedMissions(client: SupabaseClient, ownerId: string) {
  const entries: SavedMissionItem[] = [];
  for (let offset = 0; ;) {
    const result = await client.from("mission_favorites").select("mission_id,created_at", { count: "exact" })
      .eq("user_id", ownerId).order("mission_id", { ascending: true }).range(offset, offset + 99);
    assertDatabaseSuccess(result.error, "saved_missions.read");
    const rows = result.data ?? [];
    if (rows.length) {
      const visible = await client.from("missions").select("id,title,summary,status").in("id", rows.map((row) => row.mission_id));
      assertDatabaseSuccess(visible.error, "saved_missions.visible_resources");
      for (const row of rows) {
        const mission = visible.data?.find((item) => item.id === row.mission_id && item.status !== "archived");
        entries.push({ missionId: row.mission_id, savedAt: new Date(row.created_at).toISOString(),
          mission: mission ? { id: mission.id, title: mission.title, summary: mission.summary } : null });
      }
    }
    if (result.count === null) throw new Error("Saved mission count unavailable");
    offset += rows.length;
    if (offset >= result.count) break;
    if (!rows.length) throw new Error("Saved mission page incomplete");
  }
  return savedMissionListSchema.parse(entries);
}

export async function saveMissionPreference(client: SupabaseClient, raw: unknown) {
  const request = remoteSavedMissionRequestSchema.parse(raw);
  const result = await client.rpc("set_saved_mission", { _request_id: request.requestId, _mission_id: request.missionId, _saved: request.saved });
  if (result.error) throwMutationError(result.error, "saved_missions.set");
  const row = result.data?.[0];
  return savedMissionResultSchema.parse({ missionId: row?.mission_id, saved: row?.saved });
}
