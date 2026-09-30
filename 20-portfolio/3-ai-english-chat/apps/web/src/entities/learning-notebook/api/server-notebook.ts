import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDatabaseSuccess, throwMutationError } from "@/shared/api/supabase/http";
import { notebookEntrySchema, notebookIdentity, notebookSchema, saveNotebookRequestSchema, type NotebookEntry, type SaveNotebookRequest } from "../model/notebook";

export const remoteNotebookRequestSchema = saveNotebookRequestSchema.superRefine((request, context) => {
  if (!z.uuid().safeParse(request.draft.source.conversationId).success) {
    context.addIssue({ code: "custom", path: ["draft", "source", "conversationId"], message: "Invalid conversation identifier" });
  }
});

export async function loadLearningNotebook(client: SupabaseClient, ownerId: string) {
  const entries: NotebookEntry[] = [];
  for (let offset = 0; ;) {
    const result = await client.from("learning_notebook_entries").select("id,draft,created_at", { count: "exact" })
      .eq("user_id", ownerId).order("id", { ascending: true }).range(offset, offset + 999);
    assertDatabaseSuccess(result.error, "learning_notebook.read");
    for (const row of result.data ?? []) entries.push(notebookEntrySchema.parse({ id: row.id, draft: row.draft, createdAt: new Date(row.created_at).toISOString() }));
    if (result.count === null) throw new Error("Notebook count unavailable");
    offset += result.data?.length ?? 0;
    if (offset >= result.count) break;
    if (!result.data?.length) throw new Error("Notebook page incomplete");
  }
  return notebookSchema.parse({ version: 1, entries });
}

export async function saveLearningNotebook(admin: SupabaseClient, ownerId: string, raw: SaveNotebookRequest) {
  const request = remoteNotebookRequestSchema.parse(raw);
  const result = await admin.rpc("save_learning_notebook", {
    _owner_id: ownerId, _request_id: request.id, _draft: request.draft, _identity_key: notebookIdentity(request.draft),
  });
  if (result.error) throwMutationError(result.error, "learning_notebook.save");
  return z.object({ entry: notebookEntrySchema, outcome: z.enum(["created", "duplicate", "replayed"]) }).strict().parse(result.data?.[0]);
}
