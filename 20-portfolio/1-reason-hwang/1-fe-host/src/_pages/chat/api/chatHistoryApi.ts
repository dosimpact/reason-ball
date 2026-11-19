import type { Client } from "@langchain/langgraph-sdk";

import { extractToolActivity } from "../model/toolActivity";
import type { ChatMessage } from "../model/chatTypes";

export type ChatHistoryItem = {
  threadId: string;
  title: string;
  graphId: string;
  updatedAt: string;
  status: string;
};

export async function listChatHistory(
  client: Client,
  graphId: string,
  signal?: AbortSignal,
  runtimeId?: string,
): Promise<ChatHistoryItem[]> {
  const threads = await client.threads.search({
    metadata: { source: "host-chat", graph_id: graphId, ...(runtimeId === "fastapi" ? { runtime: runtimeId } : {}) },
    limit: 50,
    sortBy: "updated_at",
    sortOrder: "desc",
    signal,
  });
  if (!Array.isArray(threads)) throw new Error("대화 기록 응답 형식이 올바르지 않습니다.");
  return threads.flatMap((thread) => {
    if (!isRecord(thread) || typeof thread.thread_id !== "string") return [];
    const metadata = isRecord(thread.metadata) ? thread.metadata : {};
    if (metadata.source !== "host-chat" || metadata.graph_id !== graphId || (runtimeId && metadata.runtime && metadata.runtime !== runtimeId)) return [];
    return [{
      threadId: thread.thread_id,
      title: textValue(metadata.title).trim() || "제목 없는 대화",
      graphId,
      updatedAt: textValue(thread.updated_at) || textValue(thread.created_at),
      status: textValue(thread.status) || "unknown",
    }];
  });
}

export async function loadChatHistory(
  client: Client,
  threadId: string,
  signal?: AbortSignal,
): Promise<ChatMessage[]> {
  const state = await client.threads.getState(threadId, undefined, { signal });
  return normalizeThreadMessages(state);
}

/** Restore visible conversation and tool activity, excluding intermediate assistant messages. */
export function normalizeThreadMessages(state: unknown, running = false): ChatMessage[] {
  if (!isRecord(state) || !isRecord(state.values) || !Array.isArray(state.values.messages)) return [];
  const values = state.values;
  const sourceMessages = state.values.messages;
  const presentation = isRecord(values.presentation) ? values.presentation : {};
  const messages: ChatMessage[] = [];
  const createdAt = textValue(state.created_at) || "1970-01-01T00:00:00.000Z";
  const finalAssistantIndex = sourceMessages.findLastIndex((message: unknown) =>
    isRecord(message) && visibleRole(message) === "assistant" && !hasToolCalls(message));
  const boundaries = sourceMessages.flatMap((message: unknown, index: number) => isRecord(message) && visibleRole(message) === "user" ? [index] : []);
  for (const [turn, start] of boundaries.entries()) {
    const end = boundaries[turn + 1] ?? sourceMessages.length;
    const question = sourceMessages[start];
    const push = (message: Record<string, unknown>, index: number, role: "user" | "assistant", activities?: ChatMessage["activities"]) => {
      const content = visibleMessageText(message.content);
      const program = index === finalAssistantIndex ? textValue(presentation.program) : "";
      if (!content.trim() && !program.trim() && !activities?.length) return;
      messages.push({ id: textValue(message.id) || `history-${role}-${index}`, role, content,
        createdAt: textValue(message.created_at) || textValue(message.createdAt) || createdAt, status: running && role === "assistant" && index === finalAssistantIndex ? "streaming" : "complete",
        ...(activities?.length ? { activities } : {}),
      });
    };
    push(question, start, "user");
    const turnMessages = sourceMessages.slice(start, end);
    const activities = extractToolActivity(turnMessages).map(activity => activity.status === "running" && !running ? { ...activity, status: "interrupted" as const } : activity);
    let finalIndex = -1;
    for (let index = end - 1; index > start; index--) {
      const message = sourceMessages[index];
      if (isRecord(message) && visibleRole(message) === "assistant" && !hasToolCalls(message)) { finalIndex = index; break; }
    }
    if (finalIndex >= 0) push(sourceMessages[finalIndex], finalIndex, "assistant", activities);
    else if (activities.length) {
      const ownerIndex = sourceMessages.findLastIndex((message: unknown, index: number) => index > start && index < end && isRecord(message) && visibleRole(message) === "assistant" && hasToolCalls(message));
      if (ownerIndex >= 0) push({ ...sourceMessages[ownerIndex], content: "" }, ownerIndex, "assistant", activities);
    }
  }
  // A snapshot contains only the latest presentation, never one per historic turn.
  const latest = messages.at(-1);
  if (latest?.role === "assistant" && typeof presentation.program === "string" && presentation.program.trim()) {
    latest.program = presentation.program;
    if (typeof presentation.id === "string") latest.presentationId = presentation.id;
  }
  return messages;
}

function visibleRole(message: Record<string, unknown>): "user" | "assistant" | undefined {
  const role = message.type ?? message.role;
  if (role === "human" || role === "user") return "user";
  if (role === "ai" || role === "assistant") return "assistant";
}

function hasToolCalls(message: Record<string, unknown>): boolean {
  const additional = isRecord(message.additional_kwargs) ? message.additional_kwargs : {};
  return [message.tool_calls, additional.tool_calls].some((calls) => Array.isArray(calls) && calls.length > 0);
}

export function visibleMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => {
    if (typeof block === "string") return block;
    if (!isRecord(block) || (block.type !== undefined && block.type !== "text" && block.type !== "output_text")) return "";
    return textValue(block.text);
  }).join("");
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
