export type Intent = { mode: "chat" | "report"; source: "latest" | "history" | "none"; sourceMessageId?: string | null };
export type ChatMessage = { id?: string; role: string; content?: unknown };

/** Bound classifier context only; full source/conversation remains available to generation. */
export function intentContext(messages: ChatMessage[]) {
  return messages.map((message, index) => ({ ...message, id: message.id ?? `message-${index}` })).filter(message => ["user", "assistant"].includes(message.role) && typeof message.content === "string")
    .slice(-10).map(message => {
      const text = message.content as string;
      const limit = message.role === "user" ? 6000 : 2000;
      return { id: message.id, role: message.role, content: text.length > limit ? text.slice(0, limit - 1000) + "\n[context abbreviated]\n" + text.slice(-1000) : text };
    });
}

export async function classifyIntent(messages: ChatMessage[], options: { apiUrl: string; apiKey?: string; assistantId: string; signal: AbortSignal }, fetcher: typeof fetch = fetch): Promise<Intent> {
  const response = await fetcher(`${options.apiUrl.replace(/\/$/, "")}/runs/wait`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.apiKey ? { "x-api-key": options.apiKey } : {}) },
    body: JSON.stringify({ assistant_id: options.assistantId, input: { messages: intentContext(messages) } }),
    signal: AbortSignal.any([options.signal, AbortSignal.timeout(20_000)]),
  });
  if (!response.ok) throw new Error(`의도 판단 요청이 실패했습니다 (HTTP ${response.status}).`);
  const { decision } = await response.json();
  if (!decision || !["chat", "report"].includes(decision.mode) || !["latest", "history", "none"].includes(decision.source)) {
    throw new Error("모델의 의도 판단 응답을 확인할 수 없습니다.");
  }
  if (decision.mode === "chat" || decision.source === "none") return { mode: decision.mode, source: "none", sourceMessageId: null };
  const context = intentContext(messages);
  const selected = context.find(message => message.id === decision.sourceMessageId);
  if (!selected || (decision.source === "latest" && selected.id !== context.filter(message => message.role === "user").at(-1)?.id)) {
    throw new Error("모델이 선택한 보고서 원문을 확인할 수 없습니다.");
  }
  return { mode: decision.mode, source: decision.source, sourceMessageId: selected.id };
}
