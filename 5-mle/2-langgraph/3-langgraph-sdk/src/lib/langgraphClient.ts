import { Client } from "@langchain/langgraph-sdk";

export const langGraphApiUrl = resolveLangGraphApiUrl();

function resolveLangGraphApiUrl() {
  const configured = import.meta.env.VITE_LANGGRAPH_API_URL;

  if (configured) return configured;
  if (typeof window === "undefined") return "http://localhost:2931";

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";

  return `${protocol}//${window.location.hostname}:2931`;
}

export type AssistantRecord = {
  assistant_id?: string;
  assistantId?: string;
  graph_id?: string;
  graphId?: string;
  name?: string;
  metadata?: Record<string, unknown>;
};

export type StreamLogEntry = {
  id: string;
  event: string;
  runId?: string;
  data: unknown;
  receivedAt: string;
};

export type ChatMessageRecord = {
  id: string;
  role: "human" | "ai" | "system" | "tool" | "unknown";
  content: string;
};

export function createLangGraphClient(apiUrl = langGraphApiUrl) {
  return new Client({ apiUrl });
}

export function createClientId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function assistantIdOf(assistant: AssistantRecord): string {
  return assistant.assistant_id ?? assistant.assistantId ?? assistant.graph_id ?? assistant.graphId ?? "unknown";
}

export function assistantLabelOf(assistant: AssistantRecord): string {
  const id = assistantIdOf(assistant);
  const graph = assistant.graph_id ?? assistant.graphId;
  return assistant.name ?? graph ?? id;
}

export function normalizeAssistants(value: unknown): AssistantRecord[] {
  // 1. 일반 search 결과
  // [
  //   { assistant_id: "...", graph_id: "sdk_connection" }
  // ]

  // 2. pagination 포함 결과
  // {
  //   assistants: [
  //     { assistant_id: "...", graph_id: "sdk_connection" }
  //   ],
  //   next: "..."
  // }

  if (Array.isArray(value)) return value as AssistantRecord[];

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    if (Array.isArray(objectValue.assistants)) {
      return objectValue.assistants as AssistantRecord[];
    }
  }
  return [];
}

export function normalizeStreamChunk(chunk: unknown): StreamLogEntry {
  const record = chunk && typeof chunk === "object" ? (chunk as Record<string, unknown>) : {};
  const event = String(record.event ?? record.type ?? "chunk");
  const data = record.data ?? chunk;
  const runId = extractRunId(chunk);
  return {
    id: createClientId("stream"),
    event,
    runId,
    data,
    receivedAt: new Date().toLocaleTimeString(),
  };
}

export function extractRunId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = record.run_id ?? record.runId;
  if (typeof direct === "string") return direct;
  return extractRunId(record.metadata) ?? extractRunId(record.data);
}

export function extractLatestMessageText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;

  const content = record.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && typeof (item as Record<string, unknown>).text === "string") {
          return (item as Record<string, unknown>).text;
        }
        return "";
      })
      .join("");
    if (text.trim()) return text;
  }

  const messages = record.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    return extractLatestMessageText(messages[messages.length - 1]);
  }

  for (const child of Object.values(record)) {
    const result = extractLatestMessageText(child);
    if (result) return result;
  }
  return undefined;
}

export function normalizeMessage(value: unknown, fallbackIndex = 0): ChatMessageRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = String(record.type ?? record.role ?? "unknown").toLowerCase();
  const role =
    type.includes("human") || type === "user"
      ? "human"
      : type.includes("ai") || type === "assistant"
        ? "ai"
        : type.includes("system")
          ? "system"
          : type.includes("tool")
            ? "tool"
            : "unknown";
  const content = messageContentToText(record.content);
  if (!content) return null;
  return {
    id: typeof record.id === "string" ? record.id : `message-${fallbackIndex}`,
    role,
    content,
  };
}

export function normalizeMessages(value: unknown): ChatMessageRecord[] {
  const maybeMessages = extractMessagesArray(value);
  if (!maybeMessages) return [];
  return maybeMessages
    .map((message, index) => normalizeMessage(message, index))
    .filter((message): message is ChatMessageRecord => message !== null);
}

function extractMessagesArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.messages)) return record.messages;
  if (record.values && typeof record.values === "object") {
    const values = record.values as Record<string, unknown>;
    if (Array.isArray(values.messages)) return values.messages;
  }
  return null;
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          if (typeof record.text === "string") return record.text;
          if (typeof record.content === "string") return record.content;
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}
