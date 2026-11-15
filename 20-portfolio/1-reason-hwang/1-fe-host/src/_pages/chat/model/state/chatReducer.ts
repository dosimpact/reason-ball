import type { ChatMessage, ChatThreadState } from "@/_pages/chat/model/chatTypes";

export type ChatAction =
  | { type: "graphRunStarted" }
  | { type: "historyLoading" }
  | { type: "historyLoaded"; threadId: string; messages: ChatMessage[]; running?: boolean; error?: string }
  | { type: "historyLoadFailed"; error: string | null }
  | { type: "assistantSnapshotReceived"; messageId: string; content: string; program?: string; presentationId?: string; activities?: ChatMessage["activities"] }
  | {
      type: "threadCreated";
      threadId: string;
    }
  | {
      type: "userMessageSubmitted";
      message: ChatMessage;
    }
  | {
      type: "assistantMessageStarted";
      message: ChatMessage;
    }
  | {
      type: "assistantMessageDeltaReceived";
      content: string;
    }
  | {
      type: "assistantMessageCompleted";
      messageId?: string;
    }
  | {
      type: "streamFailed";
      messageId?: string;
      error: string;
    }
  | {
      type: "threadReset";
    };

export const initialChatState: ChatThreadState = {
  threadId: null,
  messages: [],
  status: "idle",
  error: null,
};

export function chatReducer(
  state: ChatThreadState,
  action: ChatAction,
): ChatThreadState {
  if ((action.type === "assistantMessageCompleted" || action.type === "streamFailed") && action.messageId && state.messages.findLast(message => message.role === "assistant")?.id !== action.messageId) return state;
  switch (action.type) {
    case "graphRunStarted":
      return { ...initialChatState, status: "creating_thread" };
    case "historyLoading":
      return { ...state, status: "loading_history", error: null };
    case "historyLoaded":
      return { threadId: action.threadId, messages: action.messages, status: action.running ? "streaming" : action.error ? "error" : "idle", error: action.error ?? null };
    case "historyLoadFailed":
      return { ...state, status: action.error ? "error" : "idle", error: action.error };
    case "assistantSnapshotReceived":
      return { ...state, messages: state.messages.map(message => message.id === action.messageId
        ? { ...message, content: action.content, program: action.program, presentationId: action.presentationId, activities: action.activities }
        : message) };

    case "threadCreated":
      return {
        ...state,
        threadId: action.threadId,
        status: "streaming",
        error: null,
      };

    case "userMessageSubmitted":
      return {
        ...state,
        messages: [...state.messages, action.message],
        status: state.threadId ? "streaming" : "creating_thread",
        error: null,
      };

    case "assistantMessageStarted":
      return {
        ...state,
        messages: [...state.messages, action.message],
        status: "streaming",
        error: null,
      };

    case "assistantMessageDeltaReceived":
      return {
        ...state,
        messages: updateLastAssistantMessage(state.messages, (message) => ({
          ...message,
          content: `${message.content}${action.content}`,
          status: "streaming",
        })),
      };

    case "assistantMessageCompleted":
      return {
        ...state,
        messages: updateLastAssistantMessage(state.messages, (message) => ({
          ...message,
          status: message.status === "error" ? "error" : "complete",
          activities: message.activities?.map(activity => activity.status === "running" ? { ...activity, status: "interrupted" } : activity),
        })),
        status: "idle",
        error: null,
      };

    case "streamFailed":
      return {
        ...state,
        messages: updateLastAssistantMessage(state.messages, (message) => ({
          ...message,
          content: message.content || action.error,
          status: "error",
          activities: message.activities?.map(activity => activity.status === "running" ? { ...activity, status: "error" } : activity),
        })),
        status: "error",
        error: action.error,
      };

    case "threadReset":
      return initialChatState;
  }
}

function updateLastAssistantMessage(
  messages: ChatMessage[],
  update: (message: ChatMessage) => ChatMessage,
) {
  const nextMessages = [...messages];

  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    if (nextMessages[index].role === "assistant") {
      nextMessages[index] = update(nextMessages[index]);
      return nextMessages;
    }
  }

  return messages;
}
