import { isPlainObject, isArray, isString, values } from "remeda";
export type ChatItem = {
  id: string;
  role: "human" | "assistant";
  content: string;
};

type ToolStatus = "running" | "success" | "error";

export type ToolCard = {
  id: string;
  name: string;
  args?: unknown;
  status: ToolStatus;
  result?: string;
  error?: string;
};

export type StreamMessage = Record<string, unknown>;

export type MessageStreamData = StreamMessage | [StreamMessage, ...unknown[]];

export const samplePrompts = [
  "Use the calculator tool to multiply 12 by 7, then explain the result.",
  "Look up the LangGraph term ToolNode and summarize it.",
];

export function contentToText(content: unknown): string {
  if (isString(content)) return content;
  if (isArray(content)) {
    return content
      .map((item) => {
        if (isString(item)) return item;
        if (isPlainObject(item) && isString(item.text)) return item.text;
        if (isPlainObject(item) && isString(item.content))
          return item.content;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

export function extractMessages(value: unknown): StreamMessage[] {
  if (isArray(value)) return value.flatMap(extractMessages);
  if (!isPlainObject(value)) return [];

  const maybeType = value.type ?? value.role;
  if (
    isString(maybeType) &&
    ("content" in value || "tool_calls" in value)
  ) {
    return [value];
  }

  const messages = value.messages;
  if (isArray(messages)) return messages.flatMap(extractMessages);

  return values(value).flatMap(extractMessages);
}

export function toolCallsFromMessage(message: StreamMessage): StreamMessage[] {
  if (isArray(message.tool_calls))
    return message.tool_calls as Record<string, unknown>[];

  const additional = message.additional_kwargs;
  if (isPlainObject(additional) && isArray(additional.tool_calls)) {
    return additional.tool_calls as Record<string, unknown>[];
  }

  return [];
}

export function toolCallIdOf(call: StreamMessage, fallback: string): string {
  return String(call.id ?? call.tool_call_id ?? fallback);
}

export function toolNameOf(call: StreamMessage): string {
  if (isString(call.name)) return call.name;
  if (isPlainObject(call.function) && isString(call.function.name)) {
    return call.function.name;
  }
  return "tool";
}

export function toolArgsOf(call: StreamMessage): unknown {
  if ("args" in call) return call.args;
  if (isPlainObject(call.function) && isString(call.function.arguments)) {
    try {
      return JSON.parse(call.function.arguments);
    } catch {
      return call.function.arguments;
    }
  }
  return {};
}

export function isMessageStreamData(
  value: unknown,
): value is MessageStreamData {
  if (isPlainObject(value)) return true;
  return isArray(value) && value.some(isPlainObject);
}

export function messageFromStream(
  data: MessageStreamData,
): StreamMessage | null {
  if (isArray(data)) {
    const firstRecord = data.find(isPlainObject);
    return firstRecord ?? null;
  }
  return isPlainObject(data) ? data : null;
}

export function upsertToolCall(cards: ToolCard[], next: ToolCard): ToolCard[] {
  const index = cards.findIndex((card) => card.id === next.id);
  if (index < 0) return [next, ...cards];
  return cards.map((card) =>
    card.id === next.id ? { ...card, ...next } : card,
  );
}

export function latestToolCard(
  cards: ToolCard[],
  toolCallId: string,
): ToolCard | undefined {
  return cards.find((card) => card.id === toolCallId) ?? cards[0];
}
