"use client";

import { useState } from "react";
import { AlertTriangle, CircleStop, Play, Square } from "lucide-react";
import type { MonitoringState } from "@/entities/strategy-monitor";
import type { TradePlan } from "@/entities/tutorial";
import { Button } from "@/shared/ui/button";
import styles from "./strategy-monitor.module.css";

const statusNames: Record<MonitoringState["status"], string> = {
  PENDING: "진입 대기", OPEN: "모의 포지션 진행", CLOSED_TP: "목표 청산", CLOSED_SL: "손절 청산",
  INVALIDATED_STOP: "파동 무효화로 중단", EXPIRED: "진입 없이 종료", ABORTED: "수동 중단", INDETERMINATE: "봉 안의 순서 판정 불가",
};
const healthNames: Record<MonitoringState["health"], string> = { unknown: "판정 대기", healthy: "정상", warning: "경계 접근", invalidated: "파동 전제 훼손" };
const terminal = new Set<MonitoringState["status"]>(["CLOSED_TP", "CLOSED_SL", "INVALIDATED_STOP", "EXPIRED", "ABORTED", "INDETERMINATE"]);
const number = (value: number | null, unit = "") => value === null ? "—" : `${value.toFixed(2)}${unit}`;

export function StrategyMonitor({ plan, monitoring, history = [], sourceType, onAbort, onStart, onStop, autoMonitoring, pending, error, showAutoControls = true, showAbortControls = true }: {
  plan: Pick<TradePlan, "id" | "revision"> | null; monitoring: MonitoringState | null; history?: MonitoringState[]; sourceType: "dummy" | "binance";
  onAbort: (reason: string) => void; onStart: () => void; onStop: () => void; autoMonitoring: boolean; pending: boolean; error?: string; showAutoControls?: boolean; showAbortControls?: boolean;
}) {
  const [reason, setReason] = useState("");
  if (!plan || !monitoring) return null;
  const ended = terminal.has(monitoring.status);
  const prior = history.filter((item) => item.planId !== monitoring.planId);
  return <section className={styles.panel} aria-label="전략 실행 모니터링">
    <header className={styles.header}><div><span className={styles.eyebrow}>STRATEGY MONITOR · REV {plan.revision}</span><h2>전략 실행 모니터링</h2></div><span className={styles.status} data-status={monitoring.status}>{statusNames[monitoring.status]}</span></header>
    <p className={styles.disclaimer}>교육용 long 모의매매입니다. 실제 주문이나 틱 가격이 아닌 마지막 확정봉으로 평가합니다. 수량 1, 수수료·슬리피지 0 기준입니다.</p>
    <div className={styles.health} data-health={monitoring.health} aria-live="polite"><span className={styles.healthDot} /><strong>{healthNames[monitoring.health]}</strong><span>{monitoring.rule.kind === "wave4-overlap" ? "Wave 4와 Wave 1 겹침" : "가격 경계"} {monitoring.rule.level.toFixed(2)} · {monitoring.policy === "auto-abort" ? "자동 중단" : "경고만"}</span></div>
    <div className={styles.metrics}><div><span>마지막 확정봉 종가</span><strong>{number(monitoring.currentPrice)}</strong></div><div><span>미실현 손익 · 1단위</span><strong>{number(monitoring.unrealizedPnl)}</strong></div><div><span>고정 최초위험 대비 live R</span><strong>{number(monitoring.liveR, "R")}</strong></div><div><span>무효화 경계까지</span><strong>{monitoring.distanceToInvalidation === null ? "—" : `${number(monitoring.distanceToInvalidation)} (${number(monitoring.distancePercent, "%")})`}</strong></div></div>
    <p className={styles.observed}>관측 봉 UTC: {new Date(monitoring.observedThrough * 1000).toISOString()} · 상태 {monitoring.status}{monitoring.realizedR !== null && ` · 확정 손익 ${number(monitoring.realizedR, "R")}`}</p>
    {showAutoControls && sourceType === "binance" && !ended && <div className={styles.auto}><div><strong>Binance 확정봉 자동 감시</strong><span>시작하면 60초마다 새로 닫힌 봉을 확인합니다.</span></div>{autoMonitoring ? <Button variant="secondary" onClick={onStop}><Square size={14} /> 감시 중지</Button> : <Button variant="secondary" onClick={onStart} disabled={pending}><Play size={14} /> 감시 시작</Button>}</div>}
    {showAbortControls && !ended && <div className={styles.abort}><label htmlFor="monitor-abort-reason"><CircleStop size={15} /> 수동 중단 이유</label><textarea id="monitor-abort-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={2000} placeholder="현재 공개된 봉을 기준으로 중단하는 이유를 적으세요." /><Button variant="outline" onClick={() => onAbort(reason.trim())} disabled={pending || reason.trim().length < 3}>수동 중단</Button></div>}
    {error && <p className={styles.error} role="alert"><AlertTriangle size={14} /> {error}</p>}
    <div className={styles.log}><h3>이벤트 기록</h3>{monitoring.events.length ? <ol>{monitoring.events.map((event) => <li key={event.id}><span className={styles.eventCode}>#{event.sequence} {event.kind}</span><span>{event.reason}</span><small>{new Date(event.candleTime * 1000).toISOString()} UTC{event.price !== null && ` · ${event.price.toFixed(2)}`}</small></li>)}</ol> : <p>아직 기록된 이벤트가 없습니다.</p>}</div>
    {prior.length > 0 && <details className={styles.prior}><summary>이전 계획의 실행 이력 {prior.length}개</summary>{prior.map((item) => <p key={item.planId}>{item.planId.slice(0, 8)} · {statusNames[item.status]} · 이벤트 {item.events.length}개</p>)}</details>}
  </section>;
}
