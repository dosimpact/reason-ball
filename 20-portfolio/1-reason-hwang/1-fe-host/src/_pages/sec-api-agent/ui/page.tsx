"use client";

import { AgentInterface, agUIAdapter, fetchLLM } from "@openuidev/react-ui";
import { library, runLibraryAction } from "@/shared/ui/intelligent-ui";
import "@openuidev/react-ui/styles/index.css";
import "./sec-api-agent.css";
import "@/shared/ui/intelligent-ui/components/components.css";
import "@/shared/ui/intelligent-ui/components/theme.css";

const llm = fetchLLM({ url: "/api/sec-api-agent", streamAdapter: agUIAdapter() });
const starters = [
  { displayText: "기업 검색", prompt: "저장된 SEC 기업에서 AAPL을 찾아줘." },
  { displayText: "공시 목록", prompt: "AAPL의 저장된 최근 10-K 공시 목록을 보여줘." },
  { displayText: "원문 리서치", prompt: "AAPL의 최근 저장된 10-K 원문을 읽고 부채 만기와 리스크를 출처와 함께 보고서로 만들어줘." },
  { displayText: "기업 목록 갱신", prompt: "SEC 기업 디렉터리를 동기화하고 결과를 알려줘." },
  { displayText: "선택 기업 수집", prompt: "AAPL 최근 1년 공시와 원문을 수집해줘." },
  { displayText: "전체 수집 안내", prompt: "전체 기업 공시 수집 옵션과 범위를 설명해줘. 아직 실행하지 마." },
];

export default function SecApiAgentPage() {
  return <section aria-label="SEC API Agent" className="sec-api-agent">
    <AgentInterface llm={llm} componentLibrary={library} agentName="SEC API Agent"
      onAction={(event) => { void runLibraryAction(event); }} starters={starters}>
      <AgentInterface.Welcome title="SEC 데이터로 무엇을 할까요?" starterVariant="card" />
    </AgentInterface>
  </section>;
}
