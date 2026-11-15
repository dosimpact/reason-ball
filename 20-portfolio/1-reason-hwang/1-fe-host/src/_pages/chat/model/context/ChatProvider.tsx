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
import { discoverGraphs, graphOption, runGraphInput, type GraphOption } from "../../api/chatGraphApi";
import { listChatHistory, loadChatHistory, type ChatHistoryItem } from "../../api/chatHistoryApi";
import { createLangGraphClient } from "@/_pages/chat/api/langgraphClient";
import type {
  ChatMessage,
  ChatStatus,
} from "@/_pages/chat/model/chatTypes";
import { extractToolActivity, type ChatToolActivity } from "../toolActivity";
import { toChatStreamEvent } from "@/_pages/chat/model/langgraphEventAdapter";
import { initialCanvas, reduceCanvas, parseCanvasEvent, type CanvasContext, type CanvasEvent, type CanvasState } from "../canvas";
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
  sendMessage: (content: string, context?: CanvasContext) => Promise<void>;
  canvas: CanvasState;
  selectCanvas: (id: string) => void;
  closeCanvas: (id: string) => void;
  collapseCanvas: (value: boolean) => void;
  saveCanvasState: (id: string, state: Record<string, unknown>) => void;
  saveCanvasQuery: (id: string, args: Record<string, unknown>) => void;
  reanalyzeCanvas: (id: string) => Promise<void>;
  resetThread: () => void;
  cancelRun: () => void;
  graphId: string;
  graphs: GraphOption[];
  graphDiscoveryLoading: boolean;
  graphDiscoveryError: string | null;
  reloadGraphs: () => void;
  graphResult: unknown;
  runGraph: (input: Record<string, unknown>) => Promise<void>;
  selectGraph: (id: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [canvas, dispatchCanvas] = useReducer(reduceCanvas, initialCanvas);
  const canvasRef = useRef(canvas); canvasRef.current = canvas;
  const selectCanvas = useCallback((id: string) => dispatchCanvas({ type: "select", id }), []);
  const closeCanvas = useCallback((id: string) => dispatchCanvas({ type: "close", id }), []);
  const collapseCanvas = useCallback((value: boolean) => dispatchCanvas({ type: "collapse", value }), []);
  const saveCanvasState = useCallback((id: string, state: Record<string, unknown>) => dispatchCanvas({ type: "state", id, state }), []);
  const saveCanvasQuery = useCallback((id: string, args: Record<string, unknown>) => dispatchCanvas({ type: "query", id, args }), []);
  const stateRef = useRef(state);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [conversationVersion, setConversationVersion] = useState(0);
  const historyRequestRef = useRef<AbortController | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const operationBusy = useRef(false);
  const configResult = useMemo(() => getLangGraphConfig(), []);
  const [graphId, setGraphId] = useState(configResult.config?.assistantId ?? "starter_graph");
  const [graphs, setGraphs] = useState<GraphOption[]>([graphOption(configResult.config?.assistantId ?? "starter_graph")]);
  const [graphDiscoveryLoading, setGraphDiscoveryLoading] = useState(false);
  const [graphDiscoveryError, setGraphDiscoveryError] = useState<string | null>(null);
  const [graphRevision, setGraphRevision] = useState(0);
  const [graphResult, setGraphResult] = useState<unknown>();
  const reloadGraphs = useCallback(() => setGraphRevision(value => value + 1), []);
  useEffect(() => () => abortControllerRef.current?.abort(), []);
  const client = useMemo(() => {
    if (!configResult.config) {
      return null;
    }

    return createLangGraphClient(configResult.config);
  }, [configResult.config]);

  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    setGraphDiscoveryLoading(true); setGraphDiscoveryError(null);
    discoverGraphs(client, controller.signal).then(items => {
      if (!controller.signal.aborted) { setGraphs(items); if (items.length) setGraphId(current => items.some(item => item.id === current) ? current : items[0].id); if (!items.length) setGraphDiscoveryError("등록된 에이전트가 없습니다."); }
    }).catch(() => { if (!controller.signal.aborted) setGraphDiscoveryError("에이전트 목록을 불러오지 못했습니다. 실행 서버 연결을 확인하고 다시 조회하세요."); })
      .finally(() => { if (!controller.signal.aborted) setGraphDiscoveryLoading(false); });
    return () => controller.abort();
  }, [client, graphRevision]);

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
    dispatchCanvas({ type: "clear" });
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    dispatch({ type: "historyLoading" });
    try {
      const jsonMode = graphs.find(graph => graph.id === graphId)?.mode === "json";
      const snapshot = jsonMode ? await client.threads.getState(threadId, undefined, { signal: controller.signal }) : undefined;
      const messages = jsonMode ? [] : await loadChatHistory(client, threadId, controller.signal);
      if (abortControllerRef.current !== controller) return;
      if (controller.signal.aborted) {
        dispatch({ type: "historyLoadFailed", error: null });
        return;
      }
      setGraphResult(snapshot?.values);
      dispatch({ type: "historyLoaded", threadId, messages });
      setConversationVersion(version => version + 1);
    } catch {
      if (abortControllerRef.current !== controller) return;
      dispatch({ type: "historyLoadFailed", error: controller.signal.aborted ? null : "대화 기록을 열지 못했습니다. 새로고침 후 다시 시도해 주세요." });
    }
  }, [client, graphId, graphs, history]);

  const sendMessage = useCallback(
    async (content: string, requestedCanvas?: CanvasContext) => {
      const trimmedContent = content.trim();

      if (
        operationBusy.current || !trimmedContent || graphs.find(graph => graph.id === graphId)?.mode === "json" ||
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

      operationBusy.current = true;
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
          config: { ...configResult.config, assistantId: graphId, streamMode: ["technical_analysis_agent", "technical_analysis_canvas_agent", "sec_modeling_agent"].includes(graphId) ? "values" : configResult.config.streamMode },
          client,
          threadId,
          content: trimmedContent,
          canvasContext: graphId === "technical_analysis_canvas_agent" ? requestedCanvas ?? (canvasRef.current.selectedId ? { reportId: canvasRef.current.selectedId } : {}) : undefined,
          onCanvas: event => { if (graphId === "technical_analysis_canvas_agent" && isCurrentRequest()) dispatchCanvas({ type: "event", threadId, runId: currentMessageId, messageId: currentMessageId, event }); },
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

        if (isCurrentRequest()) dispatchCanvas({ type: "finish", runId: currentMessageId, error: requestController.signal.aborted ? "보고서 생성이 중단되었습니다." : undefined });
        if (isCurrentRequest()) dispatch({
          type: "assistantMessageCompleted", messageId: currentMessageId,
        });
        if (isCurrentRequest()) void refreshHistory();
      } catch (error) {
        if (!isCurrentRequest()) return;
        if (assistantMessageId) dispatchCanvas({ type: "finish", runId: assistantMessageId, error: requestController.signal.aborted ? "보고서 생성이 중단되었습니다." : getErrorMessage(error) });
        if (error instanceof DOMException && error.name === "AbortError") {
          dispatch({ type: "assistantMessageCompleted", messageId: assistantMessageId });
          return;
        }

        dispatch({
          type: "streamFailed",
          error: getErrorMessage(error), messageId: assistantMessageId,
        });
      } finally { operationBusy.current = false; }
    },
    [client, configResult.config, configResult.error, graphId, graphs, refreshHistory],
  );

  const runGraph = useCallback(async (input: Record<string, unknown>) => {
    if (!client || operationBusy.current || ["creating_thread", "streaming", "loading_history"].includes(stateRef.current.status)) return;
    if (!input || typeof input !== "object" || Array.isArray(input)) { dispatch({ type: "streamFailed", error: "JSON 객체를 입력하세요." }); return; }
    operationBusy.current = true;
    const controller = new AbortController();
    abortControllerRef.current?.abort(); abortControllerRef.current = controller;
    const current = () => abortControllerRef.current === controller && !controller.signal.aborted;
    setGraphResult(undefined);
    dispatch({ type: "graphRunStarted" });
    try {
      await runGraphInput({ client, graphId, input, signal: controller.signal,
        onThread: id => { if (current()) dispatch({ type: "threadCreated", threadId: id }); },
        onValues: values => { if (current()) setGraphResult(values); },
      });
      if (current()) { dispatch({ type: "assistantMessageCompleted" }); void refreshHistory(); }
    } catch (error) {
      if (abortControllerRef.current !== controller) return;
      if (controller.signal.aborted) dispatch({ type: "assistantMessageCompleted" });
      else dispatch({ type: "streamFailed", error: getErrorMessage(error) });
    } finally { operationBusy.current = false; }
  }, [client, graphId, refreshHistory]);

  const reanalyzeCanvas = useCallback(async (id: string) => {
    if (graphId !== "technical_analysis_canvas_agent") return;
    const report = canvasRef.current.reports.find(item => item.id === id);
    if (!report?.successfulArgs || report.status !== "ready" || !report.request) return;
    const args = report.successfulArgs;
    const names = typeof args.indicators === "string" ? args.indicators.split(",") : [];
    const indicators = names.length ? names.map(name => name === "RSI" ? { name, timeperiod: Number(args.rsi_period ?? 14) } : name === "SMA" ? { name, timeperiod: Number(args.sma_period ?? 20) } : { name: "MACD", fastperiod: Number(args.macd_fast ?? 12), slowperiod: Number(args.macd_slow ?? 26), signalperiod: Number(args.macd_signal ?? 9) }) : report.request.indicators;
    await sendMessage("현재 조회에 성공한 조건으로 새 보고서를 분석해 주세요.", { reportId: report.id, request: { ticker: String(args.ticker), interval: args.interval as "1d" | "1wk", count: Number(args.count), indicators } });
  }, [sendMessage, graphId]);
  const resetThread = useCallback(() => {
    dispatchCanvas({ type: "clear" });
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setConversationVersion(version => version + 1);
    setGraphResult(undefined);
    dispatch({
      type: "threadReset",
    });
  }, []);

  const selectGraph = useCallback((id: string) => {
    if (operationBusy.current || ["streaming", "creating_thread", "loading_history"].includes(stateRef.current.status)) return;
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
      sendMessage, canvas, selectCanvas, closeCanvas, collapseCanvas, saveCanvasState, saveCanvasQuery, reanalyzeCanvas,
      cancelRun: () => abortControllerRef.current?.abort(),
      resetThread, graphId, graphs, selectGraph, graphDiscoveryLoading, graphDiscoveryError, reloadGraphs, graphResult, runGraph,
    }),
    [canvas, selectCanvas, closeCanvas, collapseCanvas, saveCanvasState, saveCanvasQuery, reanalyzeCanvas, configResult.error, resetThread, sendMessage, state.error, state.messages, state.status, state.threadId, graphId, graphs, selectGraph, conversationVersion, history, historyLoading, historyError, refreshHistory, openThread, graphDiscoveryLoading, graphDiscoveryError, reloadGraphs, graphResult, runGraph],
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
  canvasContext?: CanvasContext;
  onCanvas?: (event: CanvasEvent) => void;
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
    canvasContext: params.canvasContext,
  });

  for await (const event of stream) {
    if (params.signal?.aborted) return;
    if (event.event === "custom") { const canvasEvent = parseCanvasEvent(event.data); if (canvasEvent) params.onCanvas?.(canvasEvent); continue; }
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
