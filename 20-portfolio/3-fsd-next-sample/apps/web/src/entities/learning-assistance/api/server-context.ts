import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDatabaseSuccess, SupabaseHttpError } from "@/shared/api/supabase/http";
import { assistanceMessageSchema, type AssistanceRequest } from "../model/assistance";

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
}

export async function loadAssistanceMessages(client: SupabaseClient, ownerId: string, input: AssistanceRequest) {
  const conversation = await client.from("conversations").select("id").eq("id", input.conversationId).eq("owner_id", ownerId).eq("status", "active").maybeSingle();
  assertDatabaseSuccess(conversation.error, "assistance.conversation");
  if (!conversation.data) throw new SupabaseHttpError(404, "CONVERSATION_NOT_FOUND", "활성 대화를 찾지 못했어요.");
  // IDs are UUID-validated by the route before this filter is constructed.
  const found = await client.from("messages").select("id,client_message_id,role,parts,sequence_number").eq("conversation_id", input.conversationId).eq("status", "completed")
    .or(`id.eq.${input.messageId},client_message_id.eq.${input.messageId}`).limit(2);
  assertDatabaseSuccess(found.error, "assistance.target");
  if (found.data?.length !== 1) throw new SupabaseHttpError(404, "MESSAGE_NOT_FOUND", "완료된 메시지를 찾지 못했어요.");
  const target = found.data[0];
  const history = await client.from("messages").select("id,role,parts,sequence_number").eq("conversation_id", input.conversationId).eq("status", "completed").in("role", ["user", "assistant"])
    .lt("sequence_number", target.sequence_number).order("sequence_number", { ascending: false }).limit(7);
  assertDatabaseSuccess(history.error, "assistance.history");
  const previous = (history.data ?? []).reverse().map((row) => ({ id: row.id, role: row.role, text: textFromParts(row.parts).slice(0, 4000) })).filter((row) => row.text.trim());
  return [...previous, { id: input.messageId, role: target.role, text: textFromParts(target.parts) }].map((message) => assistanceMessageSchema.parse(message));
}
