import "server-only";

import type { UIMessageStreamWriter } from "ai";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";

export const PARSER_ASSISTANT_ID = "sec_filing_assistant_v1";

type ParserEvent =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "finish"; finishReason?: unknown; usage?: unknown }
  | { type: "data-retrieval-debug"; data?: unknown }
  | { type: "data-selected-filing"; data?: unknown };

function safeJsonParse(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function getParserBackendBaseUrl() {
  const baseUrl = process.env.PARSER_BACKEND_URL?.trim();
  return baseUrl?.length ? baseUrl : null;
}

export function requireParserBackendBaseUrl() {
  const baseUrl = getParserBackendBaseUrl();
  if (!baseUrl) {
    throw new ChatSDKError(
      "bad_request:api",
      "PARSER_BACKEND_URL is required for parser-backed chat"
    );
  }

  return baseUrl;
}

export async function ensureParserThread({ chatId }: { chatId: string }) {
  const backendBaseUrl = requireParserBackendBaseUrl();
  const response = await fetch(`${backendBaseUrl}/api/langgraph/threads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      threadId: chatId,
      assistantId: PARSER_ASSISTANT_ID,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ChatSDKError(
      "bad_request:api",
      "Failed to initialize parser runtime thread"
    );
  }

  return { threadId: chatId, backendBaseUrl };
}

export async function pipeParserSseToUiWriter({
  stream,
  writer,
}: {
  stream: ReadableStream<Uint8Array>;
  writer: UIMessageStreamWriter<ChatMessage>;
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finishWritten = false;

  writer.write({ type: "start" });

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const line = rawEvent
        .split("\n")
        .find((candidate) => candidate.startsWith("data: "));
      if (!line) {
        continue;
      }

      let payload: ParserEvent;
      try {
        payload = JSON.parse(line.slice(6)) as ParserEvent;
      } catch {
        continue;
      }

      switch (payload.type) {
        case "text-start":
          writer.write({ type: "text-start", id: payload.id });
          break;
        case "text-delta":
          writer.write({
            type: "text-delta",
            id: payload.id,
            delta: payload.delta,
          });
          break;
        case "text-end":
          writer.write({ type: "text-end", id: payload.id });
          break;
        case "data-retrieval-debug":
          writer.write({
            type: "data-retrieval-debug",
            data: safeJsonParse(payload.data),
            transient: true,
          });
          break;
        case "data-selected-filing":
          writer.write({
            type: "data-selected-filing",
            data: safeJsonParse(payload.data),
            transient: true,
          });
          break;
        case "finish":
          writer.write({
            type: "finish",
            finishReason: "stop",
          });
          finishWritten = true;
          break;
        default:
          break;
      }
    }
  }

  if (!finishWritten) {
    writer.write({
      type: "finish",
      finishReason: "stop",
    });
  }
}
