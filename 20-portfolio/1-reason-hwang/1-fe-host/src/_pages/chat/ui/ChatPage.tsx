"use client";

import { GraphTestResult } from "./GraphTestResult";
import { GraphTestInput } from "./GraphTestInput";
import { SidebarTrigger } from "@/shared/ui/sidebar";
import { Button } from "@/shared/ui/button";
import { ChatHistory } from "./ChatHistory";
import { ChatActivity } from "./ChatActivity";
import { GraphSelector } from "./GraphSelector";
import { AgentConversation, ChatNotice, ConversationText } from "@/shared/ui/agent-conversation";
import { OutputView } from "@/shared/ui/intelligent-ui";
import { useChat } from "../model/context/useChat";

export function ChatPage() {
  const { error, messages, resetThread, cancelRun, sendMessage, status, graphId, graphs, selectGraph, history, historyLoading, historyError, refreshHistory, openThread, threadId, conversationVersion, runGraph, graphResult, graphDiscoveryError, reloadGraphs } = useChat();
  const busy = status === "streaming" || status === "creating_thread" || status === "loading_history";
  const selected = graphs.find(graph => graph.id === graphId);
  const jsonMode = selected?.mode === "json";
  const discoveryNotice = graphDiscoveryError ?? selected?.schemaError;
  const starters = graphId === "technical_analysis_agent" ? [
    { displayText: "AAPL 일봉 분석", prompt: "AAPL 최근 120개 일봉을 RSI·SMA·MACD로 분석해 줘." },
    { displayText: "MSFT 주봉 분석", prompt: "MSFT 최근 120개 주봉의 추세를 분석해 줘." },
    { displayText: "삼성전자 분석", prompt: "005930.KS 최근 60개 일봉을 분석해 줘." },
  ] : graphId === "sec_deep_agent" ? [
    { displayText: "기업 찾기", prompt: "저장된 SEC 기업에서 AAPL을 찾아줘." },
    { displayText: "공시 찾기", prompt: "AAPL의 저장된 최근 10-K 공시 목록을 보여줘." },
  ] : [{ displayText: "대화 시작", prompt: "안녕하세요. 어떤 도움을 줄 수 있나요?" }];
  const conversationMessages = jsonMode ? graphResult === undefined ? [] : [{ id: "graph-test-result", role: "assistant" as const, content: "실행 결과", view: <GraphTestResult result={graphResult} /> }] : messages.map((message, index) => ({
    id: message.id, role: message.role === "user" ? "user" as const : "assistant" as const,
    content: message.content,
    view: <div><ChatActivity activities={message.activities} streaming={message.status === "streaming"} />{message.content && <ConversationText text={message.content} />}{message.program && <OutputView program={message.program} active={!busy && index === messages.length - 1} />}</div>,
  }));
  return <AgentConversation key={`${graphId}:${conversationVersion}`} title="에이전트" resetLabel={jsonMode ? "새 실행" : "새 대화"}
    welcomeTitle={jsonMode ? `${selected?.name ?? graphId} 테스트` : "무엇을 도와드릴까요?"}
    description={jsonMode ? "입력 스키마와 예시를 확인하고 JSON으로 그래프를 실행하세요." : `${selected?.name ?? graphId} 에이전트와 대화하세요.`}
    starters={jsonMode ? undefined : starters}
    headerLeading={<SidebarTrigger className="md:hidden" aria-label="메뉴 열기" />}
    headerControls={<div className="agent-conversation__header-controls">
      <GraphSelector graphs={graphs} value={graphId} onChange={selectGraph} disabled={busy} />
      {<ChatHistory label={jsonMode ? "실행 기록" : "대화 기록"} items={history} loading={historyLoading} error={historyError} disabled={busy} selectedId={threadId} onRefresh={refreshHistory} onSelect={openThread} />}
    </div>}
    status={(error || discoveryNotice || busy) ? <ChatNotice tone={error || discoveryNotice ? "error" : "status"}>{error ?? discoveryNotice ?? (status === "loading_history" ? "대화를 불러오는 중…" : "에이전트가 실행 중입니다…")}{discoveryNotice && <Button variant="link" onClick={() => void reloadGraphs()}>목록 다시 불러오기</Button>}</ChatNotice> : undefined}
    composer={jsonMode ? <GraphTestInput key={graphId} description={selected?.description} schema={selected?.inputSchema} example={selected?.exampleInput} busy={busy} onRun={runGraph} onCancel={cancelRun} /> : undefined}
    busy={busy} messages={conversationMessages} onSend={sendMessage} onCancel={cancelRun} onReset={resetThread} />;
}
