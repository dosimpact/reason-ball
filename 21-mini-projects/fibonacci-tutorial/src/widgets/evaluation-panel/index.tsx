import { Activity, ArrowUpRight, CircleHelp, Hourglass, ListChecks } from "lucide-react";
import type { TradeEvaluation, TradePlan } from "@/entities/tutorial";
import { Card } from "@/shared/ui/card";

const outcome: Record<TradeEvaluation["status"], { label: string; tone: string }> = {
  pending: { label: "진입 대기", tone: "neutral" }, open: { label: "포지션 진행 중", tone: "blue" }, target: { label: "목표가 도달", tone: "green" }, stop: { label: "손절가 도달", tone: "red" }, indeterminate: { label: "판정 불가", tone: "amber" }, expired: { label: "관찰 종료", tone: "neutral" },
};

export function EvaluationPanel({ plan, evaluation, revealed, total }: { plan: TradePlan | null; evaluation?: TradeEvaluation; revealed: number; total: number }) {
  return <Card className="evaluation-card"><div className="evaluation-heading"><div><span className="eyebrow">PRICE-ONLY COMPARISON</span><h2>가격 조건 비교 평가</h2></div><div className="evaluation-icon"><Activity size={19} /></div></div><p className="panel-description">기존 touch-v1 가격 조건을 적용한 비교 결과입니다. 전략 모니터링의 중단·청산 상태와 손익은 위 모니터링 패널에서 확인하세요.</p>
    {!plan ? <div className="empty-evaluation"><ListChecks size={22} /><strong>계획을 확정하면 평가가 시작됩니다</strong><p>파동 지점과 매매 계획을 먼저 기록해 주세요.</p></div> : !evaluation ? <div className="empty-evaluation"><Hourglass size={22} /><strong>다음 캔들을 기다리고 있습니다</strong><p>Replay를 진행하면 판단 결과가 이곳에 쌓입니다.</p></div> : <div className="evaluation-body"><div className={`outcome-banner tone-${outcome[evaluation.status].tone}`}><span className="outcome-dot" /><div><small>현재 평가</small><strong>{outcome[evaluation.status].label}</strong></div>{evaluation.status === "target" && <ArrowUpRight size={20} />}</div>
      <div className="evaluation-stats"><div><span>진입 가격</span><strong>{evaluation.entryPrice === null ? "—" : evaluation.entryPrice.toFixed(2)}</strong></div><div><span>청산 가격</span><strong>{evaluation.exitPrice === null ? "—" : evaluation.exitPrice.toFixed(2)}</strong></div><div><span>가격 조건 비교 손익 (R)</span><strong className={evaluation.resultR !== null && evaluation.resultR > 0 ? "positive" : ""}>{evaluation.resultR === null ? "—" : `${evaluation.resultR > 0 ? "+" : ""}${evaluation.resultR.toFixed(2)}R`}</strong></div></div>
      <div className="evaluation-stats"><div><span>손익률</span><strong>{evaluation.returnPercent === null ? "—" : `${evaluation.returnPercent > 0 ? "+" : ""}${evaluation.returnPercent.toFixed(2)}%`}</strong></div><div><span>계획 R:R</span><strong>{evaluation.riskRewardRatio === null ? "—" : `1:${evaluation.riskRewardRatio.toFixed(2)}`}</strong></div><div><span>평가 경로</span><strong>{evaluation.evaluationMode === "later-market" ? "사후 시장" : "Replay"}</strong></div></div>
      <p className="evaluation-reason"><CircleHelp size={15} />{evaluation.reason}</p>{evaluation.monitoringSummary && <div className="feedback-item"><strong>전략 모니터링 요약</strong><span>{evaluation.monitoringSummary}</span></div>}{evaluation.feedback.map((item, index) => <div key={`${item.rule}-${index}`} className={`feedback-item ${item.pass ? "pass" : "fail"}`}><strong>{item.rule}</strong><span>{item.reason}</span></div>)}
    </div>}
    <div className="evaluation-policy">학습용 touch-v1 · 상승 매수 스톱(진입가 이상 시가 체결 포함) · 수수료/슬리피지 0 · 같은 캔들에서 순서가 모호하면 판정 불가</div><div className="evaluation-footer"><span>공개된 캔들</span><strong>{revealed} / {total}</strong></div>
  </Card>;
}
