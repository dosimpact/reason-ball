import { isPlainObject, isArray, isString, findLast } from "remeda";
export type SdkConnectionState = {
  messages?: Array<{
    id?: string;
    type?: string;
    role?: string;
    content?: unknown;
  }>;
  answer?: string;
  final?: string;
};

function contentToText(content: unknown): string {
  if (isString(content)) return content;
  if (!isArray(content)) return "";
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
    .join("")
    .trim();
}

export function latestAssistantText(
  messages: SdkConnectionState["messages"],
): string {
  const latest = findLast(
    messages ?? [],
    (message) => message.type === "ai" || message.role === "assistant",
  );
  return contentToText(latest?.content);
}
