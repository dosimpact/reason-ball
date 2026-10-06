import { isPlainObject, isArray, isString, values } from "remeda";
type ChatItem = {
  id: string;
  role: "human" | "assistant";
  content: string;
};

type ToolStatus = "running" | "success" | "error";

type ToolCard = {
  id: string;
  name: string;
  args?: unknown;
  status: ToolStatus;
  result?: string;
  error?: string;
};

type StreamMessage = Record<string, unknown>;

export type ToolCallingState = {
  messages?: StreamMessage[];
};

export const samplePrompts = [
  "Use the calculator tool to multiply 12 by 7, then explain the result.",
  "Look up the LangGraph term ToolNode and summarize it.",
];

function contentToText(content: unknown): string {
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

function toolCallsFromMessage(message: StreamMessage): StreamMessage[] {
  if (isArray(message.tool_calls))
    return message.tool_calls as StreamMessage[];

  const additional = message.additional_kwargs;
  if (isPlainObject(additional) && isArray(additional.tool_calls)) {
    return additional.tool_calls as StreamMessage[];
  }

  return [];
}

function toolCallIdOf(call: StreamMessage, fallback: string): string {
  return String(call.id ?? call.tool_call_id ?? fallback);
}

function toolNameOf(call: StreamMessage): string {
  if (isString(call.name)) return call.name;
  if (isPlainObject(call.function) && isString(call.function.name)) {
    return call.function.name;
  }
  return "tool";
}

function toolArgsOf(call: StreamMessage): unknown {
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

function upsertToolCall(cards: ToolCard[], next: ToolCard): ToolCard[] {
  const index = cards.findIndex((card) => card.id === next.id);
  if (index < 0) return [next, ...cards];
  return cards.map((card) =>
    card.id === next.id ? { ...card, ...next } : card,
  );
}

function latestToolCard(
  cards: ToolCard[],
  toolCallId: string,
): ToolCard | undefined {
  return cards.find((card) => card.id === toolCallId) ?? cards[0];
}

export function projectMessages(messages: StreamMessage[] = []): ChatItem[] {
  return messages.flatMap<ChatItem>((message, index) => {
    const type = String(message.type ?? message.role ?? "").toLowerCase();
    const text = contentToText(message.content);
    if (!text || type.includes("tool")) return [];
    if (type.includes("human") || type === "user") {
      return [
        {
          id: String(message.id ?? `human-${index}`),
          role: "human",
          content: text,
        },
      ];
    }
    if (type.includes("ai") || type === "assistant") {
      return [
        {
          id: String(message.id ?? `assistant-${index}`),
          role: "assistant",
          content: text,
        },
      ];
    }
    return [];
  });
}

export function projectToolCards(messages: StreamMessage[] = []): ToolCard[] {
  return messages.reduce<ToolCard[]>((cards, message, index) => {
    const type = String(message.type ?? message.role ?? "").toLowerCase();
    const calls = toolCallsFromMessage(message);
    let nextCards = cards;

    if (calls.length > 0) {
      nextCards = calls.reduce((next, call, callIndex) => {
        const id = toolCallIdOf(call, `tool-${index}-${callIndex}`);
        return upsertToolCall(next, {
          id,
          name: toolNameOf(call),
          args: toolArgsOf(call),
          status: "running",
        });
      }, nextCards);
    }

    if (type.includes("tool")) {
      const toolCallId = String(message.tool_call_id ?? message.id ?? "");
      const result =
        contentToText(message.content) || JSON.stringify(message.content ?? "");
      const existing = latestToolCard(nextCards, toolCallId);
      nextCards = upsertToolCall(nextCards, {
        id: toolCallId || existing?.id || `tool-result-${index}`,
        name: String(message.name ?? existing?.name ?? "tool"),
        args: existing?.args,
        status: result.toLowerCase().startsWith("error") ? "error" : "success",
        result,
        error: result.toLowerCase().startsWith("error") ? result : undefined,
      });
    }

    return nextCards;
  }, []);
}
