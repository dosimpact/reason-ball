import type { CanvasPatch, CanvasSnapshot } from "@/study/bridge/canvas-bridge";
import type { StudyComponentArtifact } from "@/study/renderers/component-registry";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatStreamRequest = {
  threadId?: string;
  message: string;
  history: ChatHistoryMessage[];
  canvas: CanvasSnapshot;
};

export type ToolCallEvent = {
  name: string;
  input: Record<string, unknown>;
};

type StreamHandlers = {
  onMessageDelta: (delta: string) => void;
  onToolCall: (toolCall: ToolCallEvent) => void;
  onArtifact: (artifact: StudyComponentArtifact) => void;
  onCanvasPatch: (patch: CanvasPatch) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

type ParsedSseEvent = {
  event: string;
  data: unknown;
};

const LANGGRAPH_CHAT_STREAM_URL = "/api/langgraph/chat/stream";

function parseSseEvent(rawEvent: string): ParsedSseEvent | null {
  const lines = rawEvent.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data: ?/, ""));

  if (!eventLine || dataLines.length === 0) return null;

  try {
    return {
      event: eventLine.replace(/^event: ?/, "").trim(),
      data: JSON.parse(dataLines.join("\n")),
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function handleParsedEvent(parsed: ParsedSseEvent, handlers: StreamHandlers) {
  if (parsed.event === "message_delta" && isRecord(parsed.data)) {
    const delta = parsed.data.delta;
    if (typeof delta === "string") handlers.onMessageDelta(delta);
    return;
  }

  if (parsed.event === "tool_call" && isRecord(parsed.data)) {
    const name = parsed.data.name;
    const input = parsed.data.input;
    if (typeof name === "string" && isRecord(input)) {
      handlers.onToolCall({ name, input });
    }
    return;
  }

  if (parsed.event === "artifact" && isRecord(parsed.data)) {
    handlers.onArtifact(parsed.data as StudyComponentArtifact);
    return;
  }

  if (parsed.event === "canvas_patch" && isRecord(parsed.data)) {
    handlers.onCanvasPatch(parsed.data as CanvasPatch);
    return;
  }

  if (parsed.event === "done") {
    handlers.onDone();
    return;
  }

  if (parsed.event === "error" && isRecord(parsed.data)) {
    const message = parsed.data.message;
    handlers.onError(
      typeof message === "string"
        ? message
        : "The LangGraph backend returned an error.",
    );
  }
}

export async function streamLangGraphChat(
  request: ChatStreamRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  const response = await fetch(LANGGRAPH_CHAT_STREAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok || !response.body) {
    handlers.onError("The LangGraph backend is not available.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const parsed = parseSseEvent(part);
      if (parsed) handleParsedEvent(parsed, handlers);
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseEvent(buffer);
    if (parsed) handleParsedEvent(parsed, handlers);
  }
}
