import { filter, flatMap, isArray, isPlainObject, isString, join, map, pipe, values } from "remeda";
export type JsonRecord = Record<string, unknown>;

export type TodoStatus = "pending" | "in_progress" | "completed";

export type TodoItem = {
  id: string;
  content: string;
  status: TodoStatus;
  updatedAt: string;
  source: string;
};

export type TranscriptItem = {
  id: string;
  role: "human" | "assistant" | "tool" | "todo";
  content: string;
  todos?: TodoItem[];
};

export type ToolActivity = {
  id: string;
  name: string;
  status: "running" | "success" | "error";
  args?: unknown;
  result?: string;
  updatedAt: string;
};

export const samplePrompts = [
  "Plan and complete a three-step LangGraph SDK todo list demo.",
  "Create a release readiness checklist, update each todo, and summarize the final state.",
];

export function valuesOf(state: unknown): JsonRecord {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!isPlainObject(data)) return [];
  return pipe(data, values, filter(isPlainObject));
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function contentToText(content: unknown): string {
  if (isString(content)) return content;
  if (isArray(content)) {
    return pipe(content,
      map((item) => {
        if (isString(item)) return item;
        if (isPlainObject(item) && isString(item.text)) return item.text;
        if (isPlainObject(item) && isString(item.content)) return item.content;
        return "";
      }),
      join(""),
    ).trim();
  }
  return "";
}

export function normalizeTodoStatus(value: unknown): TodoStatus {
  if (value === "pending" || value === "in_progress" || value === "completed") {
    return value;
  }
  return "pending";
}

export function normalizeTodos(value: unknown, source: string, updatedAt: string): TodoItem[] {
  if (!isArray(value)) return [];
  return pipe(value, filter(isPlainObject), map((todo, index) => ({
    id: `${index}-${String(todo.content ?? `Todo ${index + 1}`)}`,
    content: isString(todo.content) ? todo.content : `Todo ${index + 1}`,
    status: normalizeTodoStatus(todo.status),
    updatedAt,
    source,
  })));
}

export function extractMessages(value: unknown): JsonRecord[] {
  if (isArray(value)) return flatMap(value, extractMessages);
  if (!isPlainObject(value)) return [];
  const maybeType = value.type ?? value.role;
  if (isString(maybeType) && ("content" in value || "tool_calls" in value)) {
    return [value];
  }

  if (isArray(value.messages)) return flatMap(value.messages, extractMessages);

  return pipe(value, values, flatMap(extractMessages));
}

export function toolCallsFromMessage(message: JsonRecord): JsonRecord[] {
  if (isArray(message.tool_calls)) return filter(message.tool_calls, isPlainObject);
  const additional = message.additional_kwargs;
  if (isPlainObject(additional) && isArray(additional.tool_calls)) {
    return filter(additional.tool_calls, isPlainObject);
  }

  return [];
}

export function toolCallIdOf(call: JsonRecord, fallback: string): string {
  return String(call.id ?? call.tool_call_id ?? fallback);
}

export function toolNameOf(call: JsonRecord): string {
  if (isString(call.name)) return call.name;
  if (isPlainObject(call.function) && isString(call.function.name)) return call.function.name;
  return "tool";
}

export function toolArgsOf(call: JsonRecord): unknown {
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

export function upsertTranscript(items: TranscriptItem[], next: TranscriptItem): TranscriptItem[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) return [...items, next];
  return map(items, (item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item));
}

export function upsertToolActivity(items: ToolActivity[], next: ToolActivity): ToolActivity[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) return [next, ...items];
  return map(items, (item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item));
}

export function latestToolActivity(items: ToolActivity[], toolCallId: string): ToolActivity | undefined {
  return items.find((item) => item.id === toolCallId) ?? items[0];
}
