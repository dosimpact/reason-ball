export type ChatToolActivity = { id: string; name: string; status: "running" | "complete" | "error" | "interrupted"; arguments?: string; result?: string };
type SnapshotMessage = { type?: string; role?: string; tool_calls?: unknown; tool_call_id?: unknown; status?: unknown; content?: unknown; additional_kwargs?: unknown };

function asText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return undefined; }
}

/** Project tool calls and their matching results from the current user turn. */
export function extractToolActivity(messages: unknown): ChatToolActivity[] {
  if (!Array.isArray(messages)) return [];
  const items = messages.filter((item): item is SnapshotMessage => !!item && typeof item === "object");
  const start = items.findLastIndex(message => message.type === "human" || message.role === "user");
  if (start < 0) return [];
  const current = items.slice(start + 1);
  const results = new Map(current.filter(message => message.type === "tool" || message.role === "tool").filter(message => typeof message.tool_call_id === "string").map(message => [message.tool_call_id, message]));
  const tools = new Map<string, ChatToolActivity>();
  for (const message of current) {
    if (!(message.type === "ai" || message.type === "assistant" || message.role === "assistant")) continue;
    const additional = message.additional_kwargs && typeof message.additional_kwargs === "object" ? message.additional_kwargs as Record<string, unknown> : {};
    const calls = Array.isArray(message.tool_calls) && message.tool_calls.length ? message.tool_calls : additional.tool_calls;
    if (!Array.isArray(calls)) continue;
    for (const call of calls) {
      if (!call || typeof call !== "object" || typeof call.id !== "string" || typeof (call.name ?? call.function?.name) !== "string") continue;
      const result = results.get(call.id);
      const args = asText(call.args ?? call.function?.arguments) ?? tools.get(call.id)?.arguments;
      const content = asText(result?.content);
      tools.set(call.id, { id: call.id, name: call.name ?? call.function.name, status: result ? result.status === "error" ? "error" : "complete" : "running", ...(args !== undefined ? { arguments: args } : {}), ...(content !== undefined ? { result: content } : {}) });
    }
  }
  return [...tools.values()];
}
