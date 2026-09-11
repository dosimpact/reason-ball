/** @jsxImportSource react */
import type { MissionEvaluation } from "@/entities/mission-run/model/types";

export function MissionAssistance({ evaluation }: { evaluation: MissionEvaluation }) {
  const snapshot = evaluation.assistance;
  const tracked = snapshot?.status === "tracked";
  const assisted = tracked && snapshot.requestCount > 0;
  const title = !tracked ? "도움 사용 기록 없음"
    : evaluation.passed ? assisted ? "도움을 받아 완료" : "자립 완료"
      : assisted ? "도움을 받아 연습 중" : "힌트 없이 연습 중";
  return <section data-testid="mission-result-assistance" className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
    <h3 className="font-black">{title}</h3>
    {tracked ? <>
      <p className="mt-2 text-sm" data-testid="mission-hint-request-count">힌트 요청 {snapshot.requestCount}회 · 최대 {snapshot.maxDepth}단계</p>
      <p className="mt-2 text-xs text-neutral-600">이 평가까지 성공한 단계별 힌트 요청 기록 기준입니다. 실제 열람 횟수나 외부 도움 여부를 뜻하지 않습니다. 힌트 사용으로 점수와 보상이 줄어들지 않습니다.</p>
    </> : <p className="mt-2 text-sm text-neutral-600">이 실행의 도움 사용을 확인할 수 없어 자립 수행 여부를 판단하지 않습니다.</p>}
  </section>;
}
