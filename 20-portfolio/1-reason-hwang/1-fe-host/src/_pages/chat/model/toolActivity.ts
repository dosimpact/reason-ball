export type ChatToolActivity = { id: string; name: string; status: "running" | "complete" | "error" | "interrupted" };
type SnapshotMessage = { type?: string; role?: string; tool_calls?: unknown; tool_call_id?: unknown; status?: unknown; additional_kwargs?: unknown };

/** Keep only execution identity/status from this turn; never copy arguments or result text. */
export function extractToolActivity(messages: unknown): ChatToolActivity[] {
  if (!Array.isArray(messages)) return [];
  const items = messages.filter((item): item is SnapshotMessage => !!item && typeof item === "object");
  const start = items.findLastIndex(message => message.type === "human" || message.role === "user");
  if (start < 0) return [];
  const current = items.slice(start + 1);
  const results = new Map(current.filter(message => message.type === "tool" || message.role === "tool").filter(message => typeof message.tool_call_id === "string").map(message => [message.tool_call_id, message.status]));
  const tools = new Map<string, ChatToolActivity>();
  for (const message of current) {
    if (!(message.type === "ai" || message.type === "assistant" || message.role === "assistant")) continue;
    const additional = message.additional_kwargs && typeof message.additional_kwargs === "object" ? message.additional_kwargs as Record<string, unknown> : {};
    const calls = Array.isArray(message.tool_calls) && message.tool_calls.length ? message.tool_calls : additional.tool_calls;
    if (!Array.isArray(calls)) continue;
    for (const call of calls) {
      if (!call || typeof call !== "object" || typeof call.id !== "string" || typeof (call.name ?? call.function?.name) !== "string") continue;
      tools.set(call.id, { id: call.id, name: call.name ?? call.function.name, status: results.has(call.id) ? results.get(call.id) === "error" ? "error" : "complete" : "running" });
    }
  }
  return [...tools.values()];
}
