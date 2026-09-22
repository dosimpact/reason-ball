"use client";

import { useState, type ReactElement } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { Button } from "@/components/ui/button";

export function SecWelcomeView({ input, busy, onChoose }: { input: ReactElement; busy: boolean; onChoose: (query: string) => void }) {
  return <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:p-8">
    <p className="mb-2 text-sm font-medium text-primary">회사 찾기 → 공시 고르기 → 필요한 내용 분석</p>
    <h2 className="text-2xl font-semibold">어느 회사의 공시를 볼까요?</h2>
    <p className="mb-6 mt-3 text-sm text-muted-foreground">회사명이나 티커를 입력하세요. 분석할 문서는 직접 선택할 수 있습니다.</p>
    <div className="mb-6 flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => onChoose("CPNG 회사를 찾아줘")}>쿠팡 CPNG</Button>
      <Button variant="outline" disabled={busy} onClick={() => onChoose("AAPL 회사를 찾아줘")}>애플 AAPL</Button>
      <Button variant="ghost" disabled={busy} onClick={() => onChoose("뭐가 가능해?")}>무엇을 할 수 있나요?</Button>
    </div>
    {input}
  </div>;
}

export function SecWelcome({ input }: { input: ReactElement }) {
  const { agent, isReady } = useAgent({ agentId: "a2ui-sec" });
  const { copilotkit } = useCopilotKit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async (query: string) => {
    if (!isReady || busy || agent.isRunning) return;
    setBusy(true);
    setError(null);
    try {
      agent.addMessage({ id: crypto.randomUUID(), role: "user", content: query });
      await copilotkit.runAgent({ agent });
    } catch {
      setError("응답을 받지 못했습니다. 입력창에서 다시 요청해 주세요.");
    } finally { setBusy(false); }
  };
  return <><SecWelcomeView input={input} busy={!isReady || busy || agent.isRunning} onChoose={choose} />{error && <p role="alert">{error}</p>}</>;
}

export function SecPromptGuide() {
  return <details className="mb-4 rounded-lg border p-3 text-sm">
    <summary className="cursor-pointer font-medium">프롬프트 예시 · 재무 차트 요청 방법</summary>
    <ol className="mt-3 list-decimal space-y-2 pl-5">
      <li>회사 찾기: “쿠팡(CPNG) 공시를 보여줘” → 분석할 공시 한 건을 선택하세요.</li>
      <li>추출과 시각화: “이 보고서의 매출과 영업이익을 연도별 그룹 막대로 비교해줘.”</li>
      <li>구성 요청: “매출 추이 선 차트와 최근 연도 순이익 카드, 재무 표를 함께 보여줘.”</li>
      <li>표현 변경: “방금 차트를 선 차트로 바꿔줘.” 새로운 지표가 없으면 추출 결과를 재사용합니다.</li>
      <li>추가 분석: “기존 지표에 영업현금흐름도 추가해서 보여줘.”</li>
    </ol>
    <p className="mt-3 text-muted-foreground">지원 차트: 막대 · 그룹 막대 · 누적 막대 · 선 · 영역 · 도넛. 표와 지표 카드를 함께 요청할 수 있습니다.</p>
    <p className="mt-3 text-muted-foreground">선택 보고서에 포함된 기간과 수치만 사용합니다. 구성 항목과 총계가 확인되면 누적 막대·도넛도 요청할 수 있습니다. 출처 보기에서 원문 값과 단위를 확인하세요.</p>
    <p className="mt-2 text-muted-foreground">대화에 기록: 새 결과를 남깁니다. Canvas: 같은 작업 화면을 갱신합니다. 일반 기능 질문은 회사 검색을 실행하지 않습니다.</p>
  </details>;
}

export function SecFinancialShortcut() {
  const { agent, isReady } = useAgent({ agentId: "a2ui-sec" });
  const { copilotkit } = useCopilotKit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const state = agent.state as { sec?: { filing?: { status?: string; formType?: string; filingDate?: string }; company?: { name?: string } } };
  const filing = state.sec?.filing;
  if (!filing) return null;
  return <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
    <Button variant="outline" disabled={!isReady || busy || agent.isRunning || filing.status !== "downloaded"} onClick={async () => {
      setBusy(true); setError("");
      try {
        agent.addMessage({ id: crypto.randomUUID(), role: "user", content: "선택한 보고서의 연결 매출과 영업이익을 기간별 그룹 막대 차트와 표로 보여줘." });
        await copilotkit.runAgent({ agent });
      } catch { setError("시각화 요청을 완료하지 못했습니다. 다시 요청해 주세요."); }
      finally { setBusy(false); }
    }}>재무 시각화</Button>
    <span className="text-muted-foreground">현재 요청 대상: {state.sec?.company?.name} · {filing.formType} · 제출 {filing.filingDate}</span>
    {error && <span role="alert">{error}</span>}
  </div>;
}
