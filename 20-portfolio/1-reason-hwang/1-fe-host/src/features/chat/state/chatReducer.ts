import type { ChatMessage, ChatThreadState } from "@/features/chat/model/chatTypes";

export type ChatAction =
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
    }
  | {
      type: "streamFailed";
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
  switch (action.type) {
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
