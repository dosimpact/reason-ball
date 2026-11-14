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
import { listChatHistory, loadChatHistory, type ChatHistoryItem } from "../../api/chatHistoryApi";
import { createLangGraphClient } from "@/_pages/chat/api/langgraphClient";
import type {
  ChatMessage,
  ChatStatus,
} from "@/_pages/chat/model/chatTypes";
import { extractToolActivity, type ChatToolActivity } from "../toolActivity";
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
  threadId: string | null;
  conversationVersion: number;
  history: ChatHistoryItem[];
  historyLoading: boolean;
  historyError: string | null;
  refreshHistory: () => Promise<void>;
  openThread: (threadId: string) => Promise<void>;
  status: ChatStatus;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  resetThread: () => void;
  cancelRun: () => void;
  graphId: string;
  graphs: { id: string; name: string }[];
  selectGraph: (id: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const stateRef = useRef(state);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [conversationVersion, setConversationVersion] = useState(0);
  const historyRequestRef = useRef<AbortController | null>(null);
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

  const refreshHistory = useCallback(async () => {
    if (!client) return;
    historyRequestRef.current?.abort();
    const controller = new AbortController();
    historyRequestRef.current = controller;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await listChatHistory(client, graphId, controller.signal);
      if (!controller.signal.aborted) setHistory(items);
    } catch {
      if (!controller.signal.aborted) setHistoryError("대화 기록을 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      if (!controller.signal.aborted) setHistoryLoading(false);
    }
  }, [client, graphId]);

  useEffect(() => {
    setHistory([]);
    setHistoryError(null);
    void refreshHistory();
    return () => historyRequestRef.current?.abort();
  }, [refreshHistory]);

  const openThread = useCallback(async (threadId: string) => {
    if (!client || ["creating_thread", "streaming", "loading_history"].includes(stateRef.current.status)) return;
    if (!history.some(item => item.threadId === threadId && item.graphId === graphId && item.status !== "busy")) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    dispatch({ type: "historyLoading" });
    try {
      const messages = await loadChatHistory(client, threadId, controller.signal);
      if (abortControllerRef.current !== controller) return;
      if (controller.signal.aborted) {
        dispatch({ type: "historyLoadFailed", error: null });
        return;
      }
      dispatch({ type: "historyLoaded", threadId, messages });
      setConversationVersion(version => version + 1);
    } catch {
      if (abortControllerRef.current !== controller) return;
      dispatch({ type: "historyLoadFailed", error: controller.signal.aborted ? null : "대화 기록을 열지 못했습니다. 새로고침 후 다시 시도해 주세요." });
    }
  }, [client, graphId, history]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();

      if (
        !trimmedContent ||
        stateRef.current.status === "creating_thread" ||
        stateRef.current.status === "streaming" ||
        stateRef.current.status === "loading_history"
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
      const requestController = new AbortController();
      abortControllerRef.current = requestController;
      const isCurrentRequest = () => abortControllerRef.current === requestController;

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

      let assistantMessageId: string | undefined;
      try {
        const threadId =
          stateRef.current.threadId ?? (await createChatThread(client, { source: "host-chat", graph_id: graphId, title: trimmedContent.slice(0, 80) }));

        if (!isCurrentRequest()) return;
        if (!stateRef.current.threadId) {
          dispatch({
            type: "threadCreated",
            threadId,
          });
        }

        assistantMessageId = createMessageId("assistant");
        const currentMessageId = assistantMessageId;
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
          signal: requestController.signal,
          onSnapshot: (content, presentation, activities) => {
            if (!isCurrentRequest()) return;
            dispatch({ type: "assistantSnapshotReceived", messageId: currentMessageId, content,
              program: presentation?.program, presentationId: presentation?.id, activities });
          },
          onDelta: (delta) => {
            if (!isCurrentRequest()) return;
            dispatch({
              type: "assistantMessageDeltaReceived",
              content: delta,
            });
          },
        });

        if (isCurrentRequest()) dispatch({
          type: "assistantMessageCompleted", messageId: currentMessageId,
        });
        if (isCurrentRequest()) void refreshHistory();
      } catch (error) {
        if (!isCurrentRequest()) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          dispatch({ type: "assistantMessageCompleted", messageId: assistantMessageId });
          return;
        }

        dispatch({
          type: "streamFailed",
          error: getErrorMessage(error), messageId: assistantMessageId,
        });
      }
    },
    [client, configResult.config, configResult.error, graphId, refreshHistory],
  );

  const resetThread = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setConversationVersion(version => version + 1);
    dispatch({
      type: "threadReset",
    });
  }, []);

  const selectGraph = useCallback((id: string) => {
    if (["streaming", "creating_thread", "loading_history"].includes(stateRef.current.status)) return;
    if (!graphs.some(graph => graph.id === id)) return;
    resetThread();
    setGraphId(id);
  }, [graphs, resetThread]);

  const value = useMemo(
    () => ({
      messages: state.messages,
      threadId: state.threadId, conversationVersion, history, historyLoading, historyError, refreshHistory, openThread,
      status: configResult.error ? "error" : state.status,
      error: configResult.error ?? state.error,
      sendMessage,
      cancelRun: () => abortControllerRef.current?.abort(),
      resetThread, graphId, graphs, selectGraph,
    }),
    [configResult.error, resetThread, sendMessage, state.error, state.messages, state.status, state.threadId, graphId, graphs, selectGraph, conversationVersion, history, historyLoading, historyError, refreshHistory, openThread],
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
  onSnapshot: (content: string, presentation?: { id: string; program: string }, activities?: ChatToolActivity[]) => void;
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
      params.onSnapshot(content, data.presentation ?? undefined, extractToolActivity(messages));
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
