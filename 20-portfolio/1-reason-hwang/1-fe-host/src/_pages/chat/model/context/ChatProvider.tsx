"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  useEffect,
} from "react";

import {
  createChatThread,
  streamChatRun,
} from "@/_pages/chat/api/chatRunApi";
import { createLangGraphClient } from "@/_pages/chat/api/langgraphClient";
import type {
  ChatMessage,
  ChatStatus,
} from "@/_pages/chat/model/chatTypes";
import { toChatStreamEvent } from "@/_pages/chat/model/langgraphEventAdapter";
import {
  chatReducer,
  initialChatState,
} from "@/_pages/chat/model/state/chatReducer";
import {
  getLangGraphConfig,
  type LangGraphConfig,
} from "@/shared/config";

type ChatContextValue = {
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  resetThread: () => void;
  graphId: string;
  graphs: { id: string; name: string }[];
  selectGraph: (id: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const stateRef = useRef(state);
  const abortControllerRef = useRef<AbortController | null>(null);
  const configResult = useMemo(() => getLangGraphConfig(), []);
  const [graphId, setGraphId] = useState(configResult.config?.assistantId ?? "starter_graph");
  const graphs = useMemo(() => {
    const items = [
      { id: "starter_graph", name: "기본 채팅" },
      { id: "simple_llm", name: "일반 에이전트" },
      { id: "technical_analysis_agent", name: "기술적 분석 에이전트 · RSI / SMA / MACD" },
    ];
    const configured = configResult.config?.assistantId;
    if (configured && !items.some(item => item.id === configured)) items.unshift({ id: configured, name: configured });
    return items;
  }, [configResult.config]);
  useEffect(() => () => abortControllerRef.current?.abort(), []);
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

        const assistantMessageId = createMessageId("assistant");
        dispatch({
          type: "assistantMessageStarted",
          message: {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            status: "streaming",
          },
        });

        await consumeStream({
          config: { ...configResult.config, assistantId: graphId, streamMode: graphId === "technical_analysis_agent" ? "values" : configResult.config.streamMode },
          client,
          threadId,
          content: trimmedContent,
          signal: abortControllerRef.current.signal,
          onSnapshot: (content, presentation) => {
            dispatch({ type: "assistantSnapshotReceived", messageId: assistantMessageId, content,
              program: presentation?.program, presentationId: presentation?.id });
          },
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
          dispatch({ type: "assistantMessageCompleted" });
          return;
        }

        dispatch({
          type: "streamFailed",
          error: getErrorMessage(error),
        });
      }
    },
    [client, configResult.config, configResult.error, graphId],
  );

  const resetThread = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    dispatch({
      type: "threadReset",
    });
  }, []);

  const selectGraph = useCallback((id: string) => {
    if (stateRef.current.status === "streaming" || stateRef.current.status === "creating_thread") return;
    if (!graphs.some(graph => graph.id === id)) return;
    resetThread();
    setGraphId(id);
  }, [graphs, resetThread]);

  const value = useMemo(
    () => ({
      messages: state.messages,
      status: configResult.error ? "error" : state.status,
      error: configResult.error ?? state.error,
      sendMessage,
      resetThread, graphId, graphs, selectGraph,
    }),
    [configResult.error, resetThread, sendMessage, state.error, state.messages, state.status, graphId, graphs, selectGraph],
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
  onSnapshot: (content: string, presentation?: { id: string; program: string }) => void;
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
    if (params.signal?.aborted) return;
    if (event.event === "values") {
      const data = event.data as { messages?: { type?: string; role?: string; content?: unknown; tool_calls?: unknown[] }[]; presentation?: { id: string; program: string } | null };
      const messages = data.messages ?? [];
      // Only the current turn's final assistant prose, never tool calls or prior turn output.
      const last = messages.at(-1);
      const content = last && (last.type === "ai" || last.role === "assistant") && !last.tool_calls?.length && typeof last.content === "string" ? last.content : "";
      params.onSnapshot(content, data.presentation ?? undefined);
      continue;
    }

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
