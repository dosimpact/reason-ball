"use client";

import { useEffect, useState } from "react";
import { InlineAnalysis } from "./InlineAnalysis";
import { PinnedCanvas } from "./canvas/PinnedCanvas";
import { CanvasSplitter } from "./canvas/CanvasSplitter";
import "./canvas/canvas.css";
import { GraphTestResult } from "./GraphTestResult";
import { GraphTestInput } from "./GraphTestInput";
import { SidebarTrigger } from "@/shared/ui/sidebar";
import { Button } from "@/shared/ui/button";
import { ChatHistory } from "./ChatHistory";
import { canvasAnalysisStarters, inlineAnalysisStarters } from "../model/technicalAnalysisStarters";
import { talibStarterGroups } from "../model/talibStarters";
import { projectNativeToolMessages } from "../model/nativeToolMessages";
import { GraphSelector } from "./GraphSelector";
import { AgentConversation, ChatNotice, ConversationText } from "@/shared/ui/agent-conversation";
import { OutputView } from "@/shared/ui/intelligent-ui";
import { useChat } from "../model/context/useChat";
import { pinItem, restorePinnedItems, storageKey, type CanvasItemSelection, type PinnedCanvasItem } from "../model/pinnedCanvas";

export function ChatPage() {
  const { fixedGraphId, runtime, runNotice, error, messages, resetThread, cancelRun, sendMessage, status, graphId, graphs, selectGraph, history, historyLoading, historyError, refreshHistory, openThread, threadId, conversationVersion, runGraph, graphResult, graphDiscoveryError, reloadGraphs } = useChat();
  const taMode = graphId === "technical_analysis_canvas_agent";
  const [pinned, setPinned] = useState<{ threadId: string | null; items: PinnedCanvasItem[] }>({ threadId: null, items: [] });
  const [canvasCollapsed, setCanvasCollapsed] = useState(false);
  const pinnedItems = pinned.threadId === threadId ? pinned.items : [];
  useEffect(() => {
    if (!threadId || !taMode) return;
    let items: PinnedCanvasItem[] = [];
    try { items = restorePinnedItems(window.localStorage.getItem(storageKey(runtime.id, threadId))); } catch { /* Browser storage may be disabled. */ }
    setPinned({ threadId, items });
  }, [threadId, taMode, runtime.id]);
  useEffect(() => {
    if (!threadId || pinned.threadId !== threadId || !taMode) return;
    try { window.localStorage.setItem(storageKey(runtime.id, threadId), JSON.stringify(pinned.items)); } catch { /* Canvas remains usable when browser storage is full or disabled. */ }
  }, [threadId, pinned, taMode, runtime.id]);
  const changePinned = (update: (items: PinnedCanvasItem[]) => PinnedCanvasItem[]) => setPinned(previous => {
    const items = update(previous.threadId === threadId ? previous.items : []);
    return previous.threadId === threadId && items === previous.items ? previous : { threadId, items };
  });
  const addPinned = (selection: CanvasItemSelection, messageId: string, reportId?: string) => {
    if (!threadId) return;
    setPinned(previous => ({ threadId, items: pinItem(previous.threadId === threadId ? previous.items : [], selection, messageId, reportId) }));
    setCanvasCollapsed(false);
  };
  const canvasVisible = taMode && pinnedItems.length > 0 && !canvasCollapsed;
  const busy = status === "streaming" || status === "creating_thread" || status === "loading_history";
  const selected = graphs.find(graph => graph.id === graphId);
  const jsonMode = selected?.mode === "json";
  const discoveryNotice = graphDiscoveryError ?? selected?.schemaError;
  const starters = graphId === "technical_analysis_agent" ? inlineAnalysisStarters
    : taMode ? canvasAnalysisStarters : graphId === "sec_modeling_agent" ? [
    { displayText: "모델링 상태 확인", prompt: "AAPL의 수집된 최근 10-K와 모델링 1·2·3단계 상태를 확인해줘." },
    { displayText: "모델링 결과 검색", prompt: "AAPL의 모델링된 공시에서 주요 사업과 수익 구조를 검색하고 근거를 보여줘. 모델링되지 않았다면 그 상태를 구분해줘." },
    { displayText: "사용 가능한 도구", prompt: "SEC 모델링에서 조회·검색·실행할 수 있는 작업과 필요한 CIK, accession number를 설명해줘. 지금 작업을 실행하지는 마." },
  ] : graphId === "sec_deep_agent" ? [
    { displayText: "기업 찾기", prompt: "저장된 SEC 기업에서 AAPL을 찾아줘." },
    { displayText: "공시 찾기", prompt: "AAPL의 저장된 최근 10-K 공시 목록을 보여줘." },
  ] : [{ displayText: "대화 시작", prompt: "안녕하세요. 어떤 도움을 줄 수 있나요?" }];
  const nativeProjection = projectNativeToolMessages(messages);
  const conversationMessages = jsonMode ? graphResult === undefined ? [] : [{ id: "graph-test-result", role: "assistant" as const, content: "실행 결과", view: <GraphTestResult result={graphResult} /> }] : messages.map((message, index) => ({
    id: message.id, role: message.role === "user" ? "user" as const : "assistant" as const,
    content: message.content,
    view: <div>{message.content && <ConversationText text={message.content} />}{message.program && (graphId === "technical_analysis_agent" ? <InlineAnalysis program={message.program} active={!busy && index === messages.length - 1} /> : <OutputView queryEndpoint={runtime.chartEndpoint} program={message.program} active={!busy && index === messages.length - 1} onCanvasAdd={taMode ? selection => addPinned(selection, message.id, message.presentationId) : undefined} />)}</div>,
  }));
  const conversation = <AgentConversation key={`${graphId}:${conversationVersion}`} title={runtime.label} resetLabel={jsonMode ? "새 실행" : "새 대화"}
    welcomeTitle={graphId === "talib_agent" ? "어떤 분석부터 해볼까요?" : jsonMode ? `${selected?.name ?? graphId} 테스트` : "무엇을 도와드릴까요?"}
    description={graphId === "sec_modeling_agent" ? "수집된 공시의 모델링 상태와 결과를 조회하고 근거를 검색합니다. 실행은 요청한 범위에서만 진행합니다." : graphId === "talib_agent" ? "237개 TA-Lib 함수를 8개 주제로 탐색하세요. 질문을 선택하면 바로 분석을 시작합니다." : jsonMode ? "입력 스키마와 예시를 확인하고 JSON으로 그래프를 실행하세요." : `${selected?.name ?? graphId} 에이전트와 대화하세요.`}
    starters={jsonMode || graphId === "talib_agent" ? undefined : starters}
    starterGroups={graphId === "talib_agent" ? talibStarterGroups : undefined}
    headerLeading={<SidebarTrigger className="md:hidden" aria-label="메뉴 열기" />}
    headerControls={<div className="agent-conversation__header-controls">
      {fixedGraphId ? ["talib_agent", "sec_modeling_agent"].includes(graphId) ? null : <p className="text-sm font-medium">{selected?.name ?? graphId}</p> : <GraphSelector graphs={graphs} value={graphId} onChange={selectGraph} disabled={busy} />}
      {taMode && pinnedItems.length > 0 && canvasCollapsed && <Button size="sm" variant="outline" onClick={() => setCanvasCollapsed(false)}>Canvas ({pinnedItems.length})</Button>}
      {<ChatHistory label={jsonMode ? "실행 기록" : "대화 기록"} items={history} loading={historyLoading} error={historyError} disabled={busy} selectedId={threadId} onRefresh={refreshHistory} onSelect={openThread} />}
    </div>}
    status={(error || discoveryNotice || runNotice) ? <ChatNotice tone={error || discoveryNotice ? "error" : "status"}>{error ?? discoveryNotice ?? runNotice ?? ""}{discoveryNotice && <Button variant="link" onClick={() => void reloadGraphs()}>목록 다시 불러오기</Button>}</ChatNotice> : undefined}
    composer={jsonMode ? <GraphTestInput key={graphId} description={selected?.description} schema={selected?.inputSchema} example={selected?.exampleInput} busy={busy} onRun={runGraph} onCancel={cancelRun} /> : undefined}
    nativeMessages={jsonMode ? undefined : nativeProjection.messages} executingToolCallIds={jsonMode ? undefined : nativeProjection.executingToolCallIds}
    busy={busy} messages={conversationMessages} onSend={sendMessage} onCancel={cancelRun} onReset={resetThread} />;
  if (!taMode) return conversation;
  return <div className={`ta-canvas-workspace${canvasVisible ? " ta-canvas-open" : ""}`}><div className="ta-canvas-chat">{conversation}</div>{canvasVisible && <><CanvasSplitter /><PinnedCanvas items={pinnedItems} queryEndpoint={runtime.chartEndpoint} busy={busy} onChange={changePinned} onClose={() => setCanvasCollapsed(true)} onAsk={(question, context) => void sendMessage(question, context)} /></>}</div>;
}
