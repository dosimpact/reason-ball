import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDatabaseSuccess } from "@/shared/api/supabase/http";
import { progressSourceSchema, type ActivityDay } from "../model/progress";

export async function loadLearningProgress(client: SupabaseClient, ownerId: string, today: string, expressionCount: number) {
  const days: ActivityDay[] = [];
  // Page the user's complete history: a default PostgREST row limit must not
  // silently shorten a long streak. The unique date is the stable order key.
  for (let offset = 0; ;) {
    const result = await client.from("daily_learning_stats")
      .select("learning_date, active_minutes, active_seconds, messages_sent, missions_started, missions_completed", { count: "exact" })
      .eq("user_id", ownerId).lte("learning_date", today)
      .order("learning_date", { ascending: true }).range(offset, offset + 999);
    assertDatabaseSuccess(result.error, "daily_learning_stats.progress");
    for (const row of result.data ?? []) days.push({ date: row.learning_date, minutes: row.active_minutes, activeSeconds: row.active_seconds,
      messages: row.messages_sent, missionsStarted: row.missions_started, missionsCompleted: row.missions_completed });
    if (result.count === null) throw new Error("Learning history count is unavailable");
    offset += result.data?.length ?? 0;
    if (offset >= result.count) break;
    if (!result.data?.length) throw new Error("Learning history page is incomplete");
  }
  return progressSourceSchema.parse({ today, days, expressionCount, source: "account" });
}
