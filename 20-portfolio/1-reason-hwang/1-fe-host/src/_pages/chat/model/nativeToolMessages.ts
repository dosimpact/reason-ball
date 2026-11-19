import type { Message } from "@ag-ui/client";
import type { ChatMessage } from "./chatTypes";

export type NativeMessage = Message;

/** Map actual tool inputs and outputs into the SDK timeline. */
export function projectNativeToolMessages(source: ChatMessage[]): { messages: NativeMessage[]; executingToolCallIds: Set<string> } {
  const messages: NativeMessage[] = [];
  const executingToolCallIds = new Set<string>();
  for (const message of source) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    if (message.role === "user") { messages.push({ id: message.id, role: "user", content: message.content }); continue; }
    const activities = [...new Map((message.activities ?? []).map(activity => [activity.id, activity])).values()];
    const calls = activities.map(activity => ({ id: `${message.id}:tool:${activity.id}`, type: "function" as const, function: { name: activity.name, arguments: activity.arguments ?? "{}" } }));
    messages.push({ id: message.id, role: "assistant", content: message.content, ...(calls.length ? { toolCalls: calls } : {}) });
    for (const [index, activity] of activities.entries()) {
      const toolCallId = calls[index].id;
      if (activity.status === "running" && message.status === "streaming") { executingToolCallIds.add(toolCallId); continue; }
      const status = activity.status === "running" ? message.status === "error" ? "error" : "interrupted" : activity.status;
      messages.push({ id: `${toolCallId}:result`, role: "tool", toolCallId, content: activity.result ?? (status === "complete" ? "완료" : ""), ...(status === "error" ? { error: activity.result ?? "도구 실행에 실패했습니다." } : status === "interrupted" ? { error: "실행이 중단되었습니다." } : {}) });
    }
  }
  return { messages, executingToolCallIds };
}
