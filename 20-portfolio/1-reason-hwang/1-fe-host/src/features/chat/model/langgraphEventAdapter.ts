import type { ChatStreamEvent } from "@/features/chat/model/chatTypes";
import type { LangGraphStreamEvent } from "@/features/chat/api/chatRunApi";

export function toChatStreamEvent(
  event: LangGraphStreamEvent,
): ChatStreamEvent | null {
  if (event.event === "metadata") {
    return {
      type: "metadata",
      metadata: event.data,
    };
  }

  if (event.event === "error") {
    return {
      type: "error",
      error: event.data.message ?? event.data.error ?? "LangGraph run failed.",
    };
  }

  if (event.event !== "messages") {
    if (event.event === "values") {
      const content = getLastAiMessageText(event.data);

      if (content) {
        return {
          type: "message_complete",
          content,
        };
      }
    }

    return null;
  }

  const [message, metadata] = event.data;
  const content = getMessageText(message);

  if (!content) {
    return {
      type: "metadata",
      metadata,
    };
  }

  return {
    type: "message_delta",
    content,
    metadata,
  };
}

function getLastAiMessageText(data: unknown) {
  if (!isRecord(data) || !Array.isArray(data.messages)) {
    return "";
  }

  const message = data.messages[data.messages.length - 1];

  if (!isRecord(message)) {
    return "";
  }

  const messageType = message.type;

  if (messageType !== "ai" && messageType !== "assistant") {
    return "";
  }

  return getMessageText(message);
}

function getMessageText(message: unknown) {
  if (!isRecord(message) || !("content" in message)) {
    return "";
  }

  const content = message.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          typeof part === "object" &&
          isRecord(part) &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
