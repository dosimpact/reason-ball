export type ChatRole = "user" | "assistant" | "system";

export type ChatMessageStatus = "complete" | "streaming" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status: ChatMessageStatus;
};

export type ChatStatus = "idle" | "creating_thread" | "streaming" | "error";

export type ChatThreadState = {
  threadId: string | null;
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
};

export type ChatStreamEvent =
  | {
      type: "message_delta";
      content: string;
      metadata?: unknown;
    }
  | {
      type: "message_complete";
      content?: string;
      metadata?: unknown;
    }
  | {
      type: "metadata";
      metadata: unknown;
    }
  | {
      type: "error";
      error: string;
    };

export type LangGraphChatInputMessage = {
  role: "user";
  content: string;
};
