import { isPlainObject, isArray, isString, isNumber, findLast } from "remeda";
export type StreamMode = "messages" | "updates" | "values" | "custom";

export type StreamingState = {
  prompt?: string;
  progress?: ProgressEvent[];
  messages?: Array<{
    id?: string;
    type?: string;
    role?: string;
    content?: unknown;
  }>;
  final?: string;
};

export type ProgressEvent = {
  node?: string;
  phase?: string;
  progress?: number;
  detail?: string;
};

export const streamModes: Array<{ mode: StreamMode; label: string }> = [
  { mode: "messages", label: "messages" },
  { mode: "updates", label: "updates" },
  { mode: "values", label: "values" },
  { mode: "custom", label: "custom" },
];

function textFromContent(content: unknown): string {
  if (isString(content)) return content;
  if (isArray(content)) {
    return content
      .map((item) => {
        if (isString(item)) return item;
        if (isPlainObject(item)) {
          const record = item;
          if (isString(record.text)) return record.text;
          if (isString(record.content)) return record.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

export function latestMessageText(
  messages: StreamingState["messages"],
): string {
  const latest = findLast(
    messages ?? [],
    (message) => message.type === "ai" || message.role === "assistant",
  );
  return textFromContent(latest?.content);
}

export function coerceProgressEvent(data: unknown): ProgressEvent {
  if (!isPlainObject(data)) return { detail: String(data ?? "") };
  const record = data;
  return {
    node: isString(record.node) ? record.node : undefined,
    phase: isString(record.phase) ? record.phase : undefined,
    progress: isNumber(record.progress) ? record.progress : undefined,
    detail:
      isString(record.detail)
        ? record.detail
        : String(record.msg ?? ""),
  };
}
