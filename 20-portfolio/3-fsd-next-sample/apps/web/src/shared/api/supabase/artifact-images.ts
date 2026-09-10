import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDatabaseSuccess, SupabaseHttpError } from "./http";

export async function requireEditableImageArtifact(client: SupabaseClient, id: string, ownerId: string) {
  const artifact = await client.from("artifacts").select("id,kind,status,conversation_id")
    .eq("id", id).eq("owner_id", ownerId).maybeSingle();
  assertDatabaseSuccess(artifact.error, "artifact_image.require_owner");
  if (!artifact.data) throw new SupabaseHttpError(404, "ARTIFACT_NOT_FOUND", "The artifact could not be found.");
  if (artifact.data.kind !== "image" || artifact.data.status === "archived") {
    throw new SupabaseHttpError(409, "ARTIFACT_IMAGE_UNAVAILABLE", "An editable image artifact is required.");
  }
  const conversation = await client.from("conversations").select("id")
    .eq("id", artifact.data.conversation_id).eq("owner_id", ownerId).eq("status", "active").maybeSingle();
  assertDatabaseSuccess(conversation.error, "artifact_image.require_conversation");
  if (!conversation.data) throw new SupabaseHttpError(404, "CONVERSATION_NOT_FOUND", "The conversation is unavailable.");
}
