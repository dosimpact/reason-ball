"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  createChatThread,
  streamChatRun,
} from "@/features/chat/api/chatRunApi";
import { createLangGraphClient } from "@/features/chat/api/langgraphClient";
import type {
  ChatMessage,
  ChatStatus,
} from "@/features/chat/model/chatTypes";
import { toChatStreamEvent } from "@/features/chat/model/langgraphEventAdapter";
import {
  chatReducer,
  initialChatState,
} from "@/features/chat/state/chatReducer";
import {
  getLangGraphConfig,
  type LangGraphConfig,
} from "@/shared/config/langgraph";

type ChatContextValue = {
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  resetThread: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const stateRef = useRef(state);
  const abortControllerRef = useRef<AbortController | null>(null);
  const configResult = useMemo(() => getLangGraphConfig(), []);
  const client = useMemo(() => {
    if (!configResult.config) {
      return null;
    }

    return createLangGraphClient(configResult.config);
  }, [configResult.config]);

  stateRef.current = state;

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();

      if (
        !trimmedContent ||
        stateRef.current.status === "creating_thread" ||
        stateRef.current.status === "streaming"
      ) {
        return;
      }

      if (!configResult.config || !client) {
        dispatch({
          type: "streamFailed",
          error: configResult.error ?? "LangGraph client is not configured.",
        });
        return;
      }

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const now = new Date().toISOString();
      dispatch({
        type: "userMessageSubmitted",
        message: {
          id: createMessageId("user"),
          role: "user",
          content: trimmedContent,
          createdAt: now,
          status: "complete",
        },
      });

      try {
        const threadId =
          stateRef.current.threadId ?? (await createChatThread(client));

        if (!stateRef.current.threadId) {
          dispatch({
            type: "threadCreated",
            threadId,
          });
        }

        dispatch({
          type: "assistantMessageStarted",
          message: {
            id: createMessageId("assistant"),
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            status: "streaming",
          },
        });

        await consumeStream({
          config: configResult.config,
          client,
          threadId,
          content: trimmedContent,
          signal: abortControllerRef.current.signal,
          onDelta: (delta) => {
            dispatch({
              type: "assistantMessageDeltaReceived",
              content: delta,
            });
          },
        });

        dispatch({
          type: "assistantMessageCompleted",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        dispatch({
          type: "streamFailed",
          error: getErrorMessage(error),
        });
      }
    },
    [client, configResult.config, configResult.error],
  );

  const resetThread = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    dispatch({
      type: "threadReset",
    });
  }, []);

  const value = useMemo(
    () => ({
      messages: state.messages,
      status: configResult.error ? "error" : state.status,
      error: configResult.error ?? state.error,
      sendMessage,
      resetThread,
    }),
    [configResult.error, resetThread, sendMessage, state.error, state.messages, state.status],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error("useChat must be used within ChatProvider.");
  }

  return context;
}

async function consumeStream(params: {
  config: LangGraphConfig;
  client: ReturnType<typeof createLangGraphClient>;
  threadId: string;
  content: string;
  signal?: AbortSignal;
  onDelta: (content: string) => void;
}) {
  const stream = streamChatRun({
    client: params.client,
    config: params.config,
    threadId: params.threadId,
    messages: [
      {
        role: "user",
        content: params.content,
      },
    ],
    signal: params.signal,
  });

  for await (const event of stream) {
    const chatEvent = toChatStreamEvent(event);

    if (!chatEvent) {
      continue;
    }

    if (chatEvent.type === "message_delta") {
      params.onDelta(chatEvent.content);
      continue;
    }

    if (chatEvent.type === "message_complete" && chatEvent.content) {
      params.onDelta(chatEvent.content);
      continue;
    }

    if (chatEvent.type === "error") {
      throw new Error(chatEvent.error);
    }
  }
}

function createMessageId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "LangGraph request failed.";
}
