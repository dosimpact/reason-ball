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
import { listChatHistory, normalizeThreadMessages, visibleMessageText, type ChatHistoryItem } from "../../api/chatHistoryApi";
import { developmentChatRuntime, type ChatRuntime } from "../runtime";
import { readRunSnapshot, waitForSnapshot } from "../../api/runRecovery";
import { createLangGraphClient } from "@/_pages/chat/api/langgraphClient";
import type {
  ChatMessage,
  ChatStatus,
} from "@/_pages/chat/model/chatTypes";
import { extractToolActivity, type ChatToolActivity } from "../toolActivity";
import { toChatStreamEvent } from "@/_pages/chat/model/langgraphEventAdapter";
import { analysisRequestFromQuery } from "../analysisRequest";
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
  runtime: ChatRuntime;
  runNotice: string | null;
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
  reanalyzeInline: (args: Record<string, unknown>) => Promise<void>;
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

export function ChatProvider({ children, runtime = developmentChatRuntime }: { children: ReactNode; runtime?: ChatRuntime }) {
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
  const activeRunRef = useRef<{ threadId: string; runId?: string; controller: AbortController; json?: boolean } | null>(null);
  const stopRequested = useRef(false);
  const cancelInFlight = useRef<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [runNotice, setRunNotice] = useState<string | null>(null);
  const configResult = useMemo(() => {
    const config = getLangGraphConfig();
    return config.config ? { config: { ...config.config, apiUrl: runtime.apiUrl }, error: null } : config;
  }, [runtime.apiUrl]);
  const [graphId, setGraphId] = useState(configResult.config?.assistantId ?? "starter_graph");
  const [graphs, setGraphs] = useState<GraphOption[]>([graphOption(configResult.config?.assistantId ?? "starter_graph")]);
  const [graphDiscoveryLoading, setGraphDiscoveryLoading] = useState(false);
  const [graphDiscoveryError, setGraphDiscoveryError] = useState<string | null>(null);
  const [graphRevision, setGraphRevision] = useState(0);
  const [graphResult, setGraphResult] = useState<unknown>();
  const reloadGraphs = useCallback(() => setGraphRevision(value => value + 1), []);
  useEffect(() => () => { activeRunRef.current = null; abortControllerRef.current?.abort(); abortControllerRef.current = null; historyRequestRef.current?.abort(); }, []);
  const client = useMemo(() => {
    if (!configResult.config) {
      return null;
    }

    return createLangGraphClient(configResult.config);
  }, [configResult.config]);

  const cancelRun = useCallback(async () => {
    stopRequested.current = true;
    setRunNotice("실행 중단 요청을 전달하는 중…"); setCancelError(null);
    const active = activeRunRef.current;
    if (!client || !active?.runId || cancelInFlight.current === active.runId) return;
    const cancellingRunId = active.runId;
    cancelInFlight.current = cancellingRunId;
    let confirmed = false;
    try {
      await client.runs.cancel(active.threadId, active.runId, true, "interrupt");
      confirmed = true;
      if (activeRunRef.current === active) {
        const snapshot = await client.threads.getState(active.threadId);
        if (activeRunRef.current !== active) return;
        const restored = active.json ? [] : normalizeThreadMessages(snapshot);
        if (active.json) setGraphResult(snapshot.values);
        dispatch({ type: "historyLoaded", threadId: active.threadId, messages: restored });
        dispatchCanvas({ type: "restore", values: snapshot.values, threadId: active.threadId, runId: active.runId, messageId: restored.at(-1)?.id ?? "recovered-report", running: false });
        active.controller.abort(); setRunNotice(null);
      }
    } catch (error) {
      if (activeRunRef.current === active) { setCancelError(`${confirmed ? "실행은 중단됐지만 저장된 상태를 다시 읽지 못했습니다" : "실행 중단을 확인하지 못했습니다"}: ${getErrorMessage(error)}`); if (confirmed) active.controller.abort(); setRunNotice(null); }
    } finally { if (cancelInFlight.current === cancellingRunId) cancelInFlight.current = null; }
  }, [client]);
  const trackRun = useCallback((threadId: string, runId: string, controller: AbortController, json = false) => {
    if (abortControllerRef.current !== controller) return;
    const current = activeRunRef.current;
    if (current?.runId === runId && current.controller === controller) return;
    activeRunRef.current = { threadId, runId, controller, json };
    if (stopRequested.current) void cancelRun();
  }, [cancelRun]);

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
      const items = await listChatHistory(client, graphId, controller.signal, runtime.id);
      if (!controller.signal.aborted) setHistory(items);
    } catch {
      if (!controller.signal.aborted) setHistoryError("대화 기록을 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      if (!controller.signal.aborted) setHistoryLoading(false);
    }
  }, [client, graphId, runtime.id]);

  useEffect(() => {
    setHistory([]);
    setHistoryError(null);
    void refreshHistory();
    return () => historyRequestRef.current?.abort();
  }, [refreshHistory]);

  const openThread = useCallback(async (threadId: string) => {
    if (!client || ["creating_thread", "streaming", "loading_history"].includes(stateRef.current.status)) return;
    if (!history.some(item => item.threadId === threadId && item.graphId === graphId)) return;
    dispatchCanvas({ type: "clear" });
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    dispatch({ type: "historyLoading" });
    try {
      const jsonMode = graphs.find(graph => graph.id === graphId)?.mode === "json";
      setConversationVersion(version => version + 1);
      stopRequested.current = false; setCancelError(null);
      while (!controller.signal.aborted) {
        const { snapshot, run, running } = await readRunSnapshot(client, threadId, controller.signal);
        if (abortControllerRef.current !== controller || controller.signal.aborted) return;
        if (running && run) trackRun(threadId, run.run_id, controller, jsonMode);
        setGraphResult(jsonMode ? snapshot.values : undefined);
        const restored = jsonMode ? [] : normalizeThreadMessages(snapshot, running);
        if (graphId === "technical_analysis_canvas_agent") dispatchCanvas({ type: "restore", values: snapshot.values, threadId, runId: run?.run_id ?? `history-${threadId}`, messageId: restored.findLast(message => message.role === "assistant")?.id ?? "recovered-report", running });
        dispatch({ type: "historyLoaded", threadId, messages: restored, running,
          error: !running && run && run.status !== "success" ? `저장된 실행 상태: ${run.status}` : undefined });
        setRunNotice(running ? "서버에서 실행 중입니다. 저장된 상태를 갱신합니다. 놓친 토큰은 재생하지 않습니다." : null);
        if (!running) { activeRunRef.current = null; void refreshHistory(); break; }
        await waitForSnapshot(controller.signal);
      }
    } catch {
      if (abortControllerRef.current !== controller || controller.signal.aborted) return;
      dispatch({ type: "historyLoadFailed", error: "대화 기록을 열지 못했습니다. 새로고침 후 다시 시도해 주세요." });
    }
  }, [client, graphId, graphs, history, refreshHistory, trackRun]);

  const sendMessage = useCallback(
    async (content: string, requestedCanvas?: CanvasContext, analysisRequest?: ReturnType<typeof analysisRequestFromQuery>) => {
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
      stopRequested.current = false; setRunNotice(null); setCancelError(null); activeRunRef.current = null;
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
          stateRef.current.threadId ?? (await createChatThread(client, { source: "host-chat", runtime: runtime.id, graph_id: graphId, title: trimmedContent.slice(0, 80) }));

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
          onRun: runId => trackRun(threadId, runId, requestController),
          analysisRequest: graphId === "technical_analysis_agent" ? analysisRequest ?? null : undefined,
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
      } finally { operationBusy.current = false; if (abortControllerRef.current === requestController) { activeRunRef.current = null; stopRequested.current = false; setRunNotice(null); } }
    },
    [client, configResult.config, configResult.error, graphId, graphs, refreshHistory, runtime.id, trackRun],
  );

  const runGraph = useCallback(async (input: Record<string, unknown>) => {
    if (!client || operationBusy.current || ["creating_thread", "streaming", "loading_history"].includes(stateRef.current.status)) return;
    if (!input || typeof input !== "object" || Array.isArray(input)) { dispatch({ type: "streamFailed", error: "JSON 객체를 입력하세요." }); return; }
    operationBusy.current = true;
    stopRequested.current = false; setRunNotice(null); setCancelError(null); activeRunRef.current = null;
    const controller = new AbortController();
    abortControllerRef.current?.abort(); abortControllerRef.current = controller;
    const current = () => abortControllerRef.current === controller && !controller.signal.aborted;
    setGraphResult(undefined);
    dispatch({ type: "graphRunStarted" });
    try {
      await runGraphInput({ client, graphId, input, runtimeId: runtime.id, signal: controller.signal,
        onRun: (threadId, runId) => trackRun(threadId, runId, controller, true),
        onThread: id => { if (current()) dispatch({ type: "threadCreated", threadId: id }); },
        onValues: values => { if (current()) setGraphResult(values); },
      });
      if (current()) { dispatch({ type: "assistantMessageCompleted" }); void refreshHistory(); }
    } catch (error) {
      if (abortControllerRef.current !== controller) return;
      if (controller.signal.aborted) dispatch({ type: "assistantMessageCompleted" });
      else dispatch({ type: "streamFailed", error: getErrorMessage(error) });
    } finally { operationBusy.current = false; if (abortControllerRef.current === controller) { activeRunRef.current = null; stopRequested.current = false; setRunNotice(null); } }
  }, [client, graphId, refreshHistory, runtime.id, trackRun]);

  const reanalyzeCanvas = useCallback(async (id: string) => {
    if (graphId !== "technical_analysis_canvas_agent") return;
    const report = canvasRef.current.reports.find(item => item.id === id);
    if (!report?.successfulArgs || report.status !== "ready" || !report.request) return;
    try {
      const request = analysisRequestFromQuery(report.successfulArgs, report.request.indicators);
      await sendMessage("현재 조회에 성공한 조건으로 새 보고서를 분석해 주세요.", { reportId: report.id, request });
    } catch (error) { setCancelError(`재분석 조건을 읽지 못했습니다: ${getErrorMessage(error)}`); }
  }, [sendMessage, graphId]);
  const reanalyzeInline = useCallback(async (args: Record<string, unknown>) => {
    if (graphId !== "technical_analysis_agent") return;
    try { await sendMessage("현재 조회에 성공한 조건으로 다시 분석해 주세요.", undefined, analysisRequestFromQuery(args)); }
    catch (error) { setCancelError(`재분석 조건을 읽지 못했습니다: ${getErrorMessage(error)}`); }
  }, [sendMessage, graphId]);
  const resetThread = useCallback(() => {
    dispatchCanvas({ type: "clear" });
    activeRunRef.current = null; stopRequested.current = false; setRunNotice(null); setCancelError(null);
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
      runtime, runNotice, messages: state.messages,
      threadId: state.threadId, conversationVersion, history, historyLoading, historyError, refreshHistory, openThread,
      status: configResult.error ? "error" : state.status,
      error: configResult.error ?? cancelError ?? state.error,
      sendMessage, canvas, selectCanvas, closeCanvas, collapseCanvas, saveCanvasState, saveCanvasQuery, reanalyzeCanvas, reanalyzeInline,
      cancelRun: () => { void cancelRun(); },
      resetThread, graphId, graphs, selectGraph, graphDiscoveryLoading, graphDiscoveryError, reloadGraphs, graphResult, runGraph,
    }),
    [runtime, runNotice, cancelError, cancelRun, canvas, selectCanvas, closeCanvas, collapseCanvas, saveCanvasState, saveCanvasQuery, reanalyzeCanvas, reanalyzeInline, configResult.error, resetThread, sendMessage, state.error, state.messages, state.status, state.threadId, graphId, graphs, selectGraph, conversationVersion, history, historyLoading, historyError, refreshHistory, openThread, graphDiscoveryLoading, graphDiscoveryError, reloadGraphs, graphResult, runGraph],
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
  analysisRequest?: ReturnType<typeof analysisRequestFromQuery> | null;
  onCanvas?: (event: CanvasEvent) => void;
  onRun?: (runId: string) => void;
  onDelta: (content: string) => void;
  onSnapshot: (content: string, presentation?: { id: string; program: string }, activities?: ChatToolActivity[]) => void;
}) {
  let trackedRunId: string | undefined;
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
    analysisRequest: params.analysisRequest,
    onRunCreated: run => { trackedRunId = run.run_id; params.onRun?.(run.run_id); },
  });

  for await (const event of stream) {
    if (params.signal?.aborted) return;
    if (event.event === "metadata") { const runId = (event.data as { run_id?: string }).run_id; if (runId) { trackedRunId = runId; params.onRun?.(runId); } }
    if (event.event === "custom") { const canvasEvent = parseCanvasEvent(event.data); if (canvasEvent) params.onCanvas?.(canvasEvent); continue; }
    if (event.event === "values") {
      const data = event.data as { messages?: { type?: string; role?: string; content?: unknown; tool_calls?: unknown[] }[]; presentation?: { id: string; program: string } | null };
      const messages = data.messages ?? [];
      // Only the current turn's final assistant prose, never tool calls or prior turn output.
      const last = messages.at(-1);
      const content = last && (last.type === "ai" || last.role === "assistant") && !last.tool_calls?.length ? visibleMessageText(last.content) : "";
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
  if (params.signal?.aborted) return;
  if (!trackedRunId) throw new Error("실행 ID를 받지 못해 완료 상태를 확인할 수 없습니다. 기록에서 서버 상태를 확인하세요.");
  const run = await params.client.runs.get(params.threadId, trackedRunId, { signal: params.signal });
  if (run.status !== "success") throw new Error(`실행 완료를 확인하지 못했습니다 (상태: ${run.status}). 기록에서 서버 상태를 확인하세요.`);
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
