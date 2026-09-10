import "server-only";

import type { UIMessage } from "ai";
import { readToolApprovalTurn } from "../model/tool-approval";
import { userMessagePartsSchema } from "@/shared/api/supabase/chatbot";
import {
  assertDatabaseSuccess,
  createPrivilegedClient,
  SupabaseHttpError,
  throwMutationError,
} from "@/shared/api/supabase/http";

type GenerationClaim = {
  user_message_id: string;
  assistant_message_id: string;
  replayed: boolean;
  user_sequence_number: number;
  continuation_parts?: UIMessage["parts"];
};

export type ChatGeneration = {
  conversationId: string;
  ownerId: string;
  requestId: string;
  assistantMessageId: string;
  messages: UIMessage[];
};

type GenerationInput = {
  conversationId: string;
  ownerId: string;
  requestId: string;
  modelId: string;
  messages: UIMessage[];
};

function validateUserTurn(messages: readonly UIMessage[]) {
  const latest = messages.at(-1);
  const parts = userMessagePartsSchema.safeParse(latest?.parts);
  if (latest?.role !== "user" || !parts.success) {
    throw new SupabaseHttpError(400, "USER_TURN_REQUIRED", "A valid user message is required to start a persisted turn.");
  }
  return { id: latest.id, parts: parts.data };
}

async function claimGeneration(input: GenerationInput, user: ReturnType<typeof validateUserTurn>) {
  const admin = createPrivilegedClient();
  const claim = await admin.rpc("begin_chat_generation", {
    _conversation_id: input.conversationId,
    _owner_id: input.ownerId,
    _client_message_id: user.id,
    _parts: user.parts,
    _request_id: input.requestId,
    _model_id: input.modelId,
  });
  if (claim.error) throwMutationError(claim.error, "chat.begin_generation");
  return requireClaim(claim.data);
}

async function claimToolContinuation(input: GenerationInput) {
  let approval: ReturnType<typeof readToolApprovalTurn>;
  try { approval = readToolApprovalTurn(input.messages.at(-1)); }
  catch { throw new SupabaseHttpError(400, "INVALID_TOOL_APPROVAL", "Valid tool approval decisions are required."); }
  const claim = await createPrivilegedClient().rpc("begin_chat_tool_continuation", {
    _conversation_id: input.conversationId,
    _owner_id: input.ownerId,
    _assistant_id: approval.assistantMessageId,
    _request_id: input.requestId,
    _model_id: input.modelId,
    _decisions: approval.decisions,
  });
  if (claim.error) throwMutationError(claim.error, "chat.begin_tool_continuation");
  return requireClaim(claim.data);
}

function requireClaim(data: unknown) {
  const row = (data as GenerationClaim[] | null)?.[0];
  if (!row) throw new SupabaseHttpError(502, "CHAT_SAVE_FAILED", "The message could not be saved. Please retry.", true);
  if (row.replayed) {
    // Do not spend another AI request or overwrite the already saved response.
    // The HTTP client can restore it with the conversation messages endpoint.
    throw new SupabaseHttpError(409, "CHAT_RESPONSE_SAVED", "This response is already saved. Reload the conversation to restore it.");
  }
  return row;
}

async function loadSavedHistory(conversationId: string, throughSequence: number): Promise<UIMessage[]> {
  const admin = createPrivilegedClient();
  const history = await admin.from("messages")
    .select("id, client_message_id, role, parts, sequence_number")
    .eq("conversation_id", conversationId)
    .eq("status", "complete")
    .lte("sequence_number", throughSequence)
    .in("role", ["user", "assistant"])
    .order("sequence_number", { ascending: false })
    .limit(200);
  assertDatabaseSuccess(history.error, "chat.load_saved_messages");
  return (history.data ?? []).toReversed().map((message) => ({
    id: message.role === "user" ? message.client_message_id ?? message.id : message.id,
    role: message.role as "user" | "assistant",
    parts: message.parts as UIMessage["parts"],
  }));
}

export async function prepareChatGeneration(input: GenerationInput): Promise<ChatGeneration> {
  const row = input.messages.at(-1)?.role === "assistant"
    ? await claimToolContinuation(input)
    : await claimGeneration(input, validateUserTurn(input.messages));
  const generation: ChatGeneration = {
    conversationId: input.conversationId,
    ownerId: input.ownerId,
    requestId: input.requestId,
    assistantMessageId: row.assistant_message_id,
    messages: [],
  };
  try {
    generation.messages = await loadSavedHistory(input.conversationId, row.user_sequence_number);
    if (row.continuation_parts) generation.messages.push({ id: row.assistant_message_id, role: "assistant", parts: row.continuation_parts });
    return generation;
  } catch (error) {
    await finishChatGeneration(generation, { status: "error", parts: [] });
    throw error;
  }
}

export async function finishChatGeneration(
  generation: ChatGeneration,
  result: { status: "complete" | "error" | "cancelled"; parts: UIMessage["parts"]; finishReason?: string },
) {
  const admin = createPrivilegedClient();
  const saved = await admin.rpc("finish_chat_generation", {
    _conversation_id: generation.conversationId,
    _owner_id: generation.ownerId,
    _assistant_message_id: generation.assistantMessageId,
    _request_id: generation.requestId,
    _status: result.status,
    _parts: result.parts,
    _finish_reason: result.finishReason ?? null,
  });
  if (saved.error) throwMutationError(saved.error, "chat.finish_generation");
}
