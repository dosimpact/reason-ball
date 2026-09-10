import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { cursorPage } from "@/shared/lib/cursor-page";
import { artifactVersionDto } from "./chatbot";
import { assertDatabaseSuccess, SupabaseHttpError } from "./http";

export const artifactPageSize = z.coerce.number().int().min(1).max(200).default(100);
export const artifactVersionCursor = z.coerce.number().int().min(0).max(2_147_483_647).default(0);

export async function readArtifactVersionPage(client: SupabaseClient, artifactId: string, snapshotVersionId: string, after: number, limit: number) {
  const anchor = await client.from("artifact_versions").select("version_number")
    .eq("id", snapshotVersionId).eq("artifact_id", artifactId).maybeSingle();
  assertDatabaseSuccess(anchor.error, "artifact_versions.snapshot");
  if (!anchor.data) throw new SupabaseHttpError(404, "ARTIFACT_SNAPSHOT_NOT_FOUND", "The requested artifact version is unavailable.");
  const result = await client.from("artifact_versions")
    .select("id,artifact_id,version_number,source_message_id,content_text,content_json,storage_bucket,storage_path,published_at,created_at")
    .eq("artifact_id", artifactId).gt("version_number", after).lte("version_number", anchor.data.version_number)
    .order("version_number", { ascending: true }).limit(limit + 1);
  assertDatabaseSuccess(result.error, "artifact_versions.page");
  const page = cursorPage(result.data ?? [], limit, (row) => row.version_number as number);
  return { versions: page.items.map(artifactVersionDto), hasMore: page.hasMore, nextCursor: page.nextCursor, snapshotVersionId };
}
