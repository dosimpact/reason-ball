"use client";

import { agUIAdapter, fetchLLM, useThread, useThreadList } from "@openuidev/react-ui";
import { AgentChatFrame } from "@/shared/ui/agent-conversation";
import { useEffect, useState } from "react";
import { createSessionStorage } from "../model/session-storage";
import { library, runLibraryAction } from "@/shared/ui/intelligent-ui";

const llm = fetchLLM({ url: "/api/sec-api-agent", streamAdapter: agUIAdapter() });
const starters = [
  { displayText: "기업 검색", prompt: "저장된 SEC 기업에서 AAPL을 찾아줘." },
  { displayText: "공시 목록", prompt: "AAPL의 저장된 최근 10-K 공시 목록을 보여줘." },
  { displayText: "원문 리서치", prompt: "AAPL의 최근 저장된 10-K 원문을 읽고 부채 만기와 리스크를 출처와 함께 보고서로 만들어줘." },
  { displayText: "기업 목록 갱신", prompt: "SEC 기업 디렉터리를 동기화하고 결과를 알려줘." },
  { displayText: "선택 기업 수집", prompt: "AAPL 최근 1년 공시와 원문을 수집해줘." },
  { displayText: "전체 수집 안내", prompt: "전체 기업 공시 수집 옵션과 범위를 설명해줘. 아직 실행하지 마." },
];

function SaveMessages({ session }: { session: ReturnType<typeof createSessionStorage> }) {
  const messages = useThread((state) => state.messages);
  const loading = useThread((state) => state.isLoadingMessages);
  const threadId = useThreadList((state) => state.selectedThreadId);
  useEffect(() => {
    if (threadId && !loading && messages.length) session.save(threadId, messages);
  }, [threadId, messages, loading, session]);
  return null;
}

export default function SecApiAgentPage() {
  const [session] = useState(createSessionStorage);
  return <AgentChatFrame title="SEC API Agent" llm={llm} storage={session.storage}
    componentLibrary={library} onAction={event => { void runLibraryAction(event); }}
    starters={starters} history welcomeTitle="SEC 데이터로 무엇을 할까요?"
    description="기업과 공시를 찾고, 원문을 분석하거나 데이터를 수집하세요."
    placeholder="메시지를 입력하세요">
    <SaveMessages session={session} />
  </AgentChatFrame>;
}
