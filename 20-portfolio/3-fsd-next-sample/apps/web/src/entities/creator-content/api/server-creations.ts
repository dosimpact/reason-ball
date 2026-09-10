import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDatabaseSuccess } from "@/shared/api/supabase/http";
import { creationsSchema, type Creation } from "../model/creations";

export async function loadOwnedCreations(client: SupabaseClient, ownerId: string) {
  const items: Creation[] = [];
  for (const kind of ["character", "mission"] as const) {
    const table = kind === "character" ? "characters" : "missions";
    const fields = kind === "character" ? "id,name,tagline,status" : "id,title,summary,status";
    for (let offset = 0; ;) {
      const result = await client.from(table).select(fields, { count: "exact" }).eq("owner_id", ownerId)
        .order("id", { ascending: true }).range(offset, offset + 999);
      assertDatabaseSuccess(result.error, `${table}.owned_creations`);
      for (const item of result.data ?? []) {
        const row = item as unknown as Record<string, string>;
        items.push({ kind, id: row.id, title: kind === "character" ? row.name : row.title,
          summary: kind === "character" ? row.tagline : row.summary, status: row.status as Creation["status"] });
      }
      if (result.count === null) throw new Error("Owned content count unavailable");
      offset += result.data?.length ?? 0;
      if (offset >= result.count) break;
      if (!result.data?.length) throw new Error("Owned content page incomplete");
    }
  }
  return creationsSchema.parse({ source: "account", items });
}
