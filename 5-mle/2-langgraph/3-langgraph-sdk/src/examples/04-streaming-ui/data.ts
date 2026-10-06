import { isPlainObject, isArray, isString, isNumber } from "remeda";
import { extractLatestMessageText } from "../../lib/langgraphClient";

export type StreamMode = "messages" | "updates" | "values" | "custom";

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

export function messageTextFromStream(data: unknown): string {
  if (isArray(data) && data.length > 0) {
    const tupleText = textFromContent(
      (data[0] as Record<string, unknown> | undefined)?.content,
    );
    if (tupleText) return tupleText;

    const latest = data[data.length - 1];
    if (isPlainObject(latest)) {
      return textFromContent(latest.content);
    }
  }

  if (isPlainObject(data)) {
    const contentText = textFromContent(
      data.content,
    );
    if (contentText) return contentText;
  }

  return extractLatestMessageText(data) ?? "";
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
