"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type { StrategyConfirmInput, StrategyMode, StrategyRun, StrategyView } from "@/entities/strategy";
import { Button } from "@/shared/ui/button";
import { ChartWorkspace } from "@/widgets/chart-workspace";
import { StrategyMonitor } from "@/widgets/strategy-monitor";
import { strategyApi } from "./api";
import { PlanDraftForm } from "./plan-form";
import { StrategyIntro, StrategyShell, controlName, modeName, number, suggestedCutoff, utc } from "./shared";
import styles from "./strategy-workspace.module.css";

const terminal = new Set(["CLOSED_TP", "CLOSED_SL", "INVALIDATED_STOP", "EXPIRED", "ABORTED", "INDETERMINATE"]);

function runLine(run: StrategyRun) {
  return `${modeName(run.mode)} · ${controlName(run.controlStatus)} · ${run.monitoring.status} · ${run.observedCount}봉`;
}

function PlanRecord({ view }: { view: StrategyView }) {
  const plan = view.plan;
  if (!plan) return null;
  return <section className={styles.card} aria-label="확정 계획"><h2>확정 계획 · revision {plan.revision}</h2><p className={styles.hint}>계획 원본은 고정됩니다. 가격·파동 근거를 변경하려면 새 revision을 만드세요.</p>
    <div className={styles.metricGrid}><div className={styles.metric}><span>진입가</span><strong>{number(plan.entry)}</strong></div><div className={styles.metric}><span>손절가</span><strong>{number(plan.stopLoss)}</strong></div><div className={styles.metric}><span>목표가</span><strong>{number(plan.target)}</strong></div><div className={styles.metric}><span>무효화 가격</span><strong>{number(plan.monitoringConfig.rule.level)}</strong></div></div>
    <p>{plan.rationale}</p><p className={styles.hint}>기준 {utc(plan.asOf)} · {plan.monitoringConfig.policy === "auto-abort" ? "무효화 자동 중단" : "무효화 경고만"} · 수량 1 · 비용 0 · 갭 시가 체결 · OHLC 순서 불명은 판정 보류</p>
    <details><summary>판단 근거와 청산 전략</summary><div className={styles.history}><p>{plan.exitStrategy}</p>{plan.decisions && Object.entries(plan.decisions).map(([key, value]) => <p key={key}><strong>{key}</strong> · {value}</p>)}</div></details>
  </section>;
}

export function RunPanel({ view, run, pending, error, watching, playing, dummyCutoffs = [], onAction, onAuto, onExport }: {
  view: StrategyView; run: StrategyRun | null; pending: boolean; error: string; watching: boolean; playing: boolean;
  dummyCutoffs?: Array<{ index: number; ordinal: number; asOf: number; maxBacktestBars: number }>;
  onAction: (action: "start" | "step" | "batch" | "poll" | "pause" | "resume" | "abort" | "revise", reason?: string, asOf?: number) => void;
  onAuto: (kind: "backtest" | "forward", value: boolean) => void; onExport: () => void;
}) {
  const [abortReason, setAbortReason] = useState("");
  const [reviseMode, setReviseMode] = useState<StrategyMode>(view.mode);
  const [reviseCutoff, setReviseCutoff] = useState("");
  const [dummyReviseAsOf, setDummyReviseAsOf] = useState<number | null>(null);
  const selectedDummyRevise = dummyCutoffs.find((option) => option.asOf === dummyReviseAsOf) ?? dummyCutoffs.find((option) => option.ordinal === 8 && option.maxBacktestBars >= view.backtestBars);
  const canStart = Boolean(view.plan);
  const runActive = run && run.controlStatus !== "COMPLETED";
  const canProgress = runActive && run.controlStatus !== "PAUSED" && run.controlStatus !== "ERROR";
  return <div className={styles.column}>
    <section className={styles.card} aria-label="실행 제어"><h2>3. {modeName(view.mode)} 실행</h2><p className={styles.hint}>{view.mode === "BACKTEST" ? "기준 봉 뒤의 고정 구간을 한 봉씩, 자동으로 또는 일괄 실행합니다." : view.source.type === "dummy" ? "더미 봉을 순서대로 입력하는 포워드 동작 시뮬레이션입니다." : "새로 마감된 Binance 봉만 관찰합니다. 이 화면을 닫으면 60초 감시가 멈춥니다."}</p>
      {run ? <><div className={styles.meta}><span className={styles.pill}>{runLine(run)}</span><span className={styles.pill}>run {run.id.slice(0, 8)}</span></div><p className={styles.hint}>마지막 관측 {utc(run.monitoring.observedThrough)} · 데이터 {run.snapshotId.slice(0, 18)} · touch-v1</p>{run.lastError && <p className={styles.error} role="alert">관측 오류 · {run.lastError.message} · {run.lastError.at}</p>}</> : <p className={styles.notice}>이 계획의 실행 기록이 없습니다. 새 실행을 시작하세요.</p>}
      <div className={styles.actions}>
        <Button onClick={() => onAction("start")} disabled={!canStart || pending}>새 {modeName(view.mode)} 실행</Button>
        {runActive && run?.mode === "BACKTEST" && <><Button variant="secondary" onClick={() => onAction("step")} disabled={pending || playing || !canProgress}>한 봉 진행 <SkipForward size={14} /></Button><Button variant="secondary" onClick={() => onAuto("backtest", !playing)} disabled={pending || !canProgress}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "자동 재생 중지" : "자동 재생"}</Button><Button variant="outline" onClick={() => onAction("batch")} disabled={pending || playing || !canProgress}>전체 구간 실행</Button></>}
        {runActive && run?.mode === "FORWARD" && <Button variant="secondary" onClick={() => onAction("poll")} disabled={pending || !canProgress}>새 확정봉 확인</Button>}
        {canProgress && <Button variant="secondary" onClick={() => onAction("pause")} disabled={pending}>{run.mode === "BACKTEST" ? "실행 일시정지" : "감시 일시정지"}</Button>}
        {runActive && (run.controlStatus === "PAUSED" || run.controlStatus === "ERROR") && <Button variant="secondary" onClick={() => onAction("resume")} disabled={pending}>{run.controlStatus === "ERROR" ? "오류 확인 후 재개" : run.mode === "BACKTEST" ? "실행 재개" : "감시 재개"}</Button>}
      </div>
      {runActive && <div className={styles.form} style={{ marginTop:15 }}><label>수동 중단 이유<textarea value={abortReason} onChange={(event) => setAbortReason(event.target.value)} maxLength={2000} placeholder="계획을 중단하는 이유를 적으세요." /></label><Button variant="outline" onClick={() => { onAction("abort", abortReason.trim()); setAbortReason(""); }} disabled={pending || abortReason.trim().length < 3}>계획 중단 · 모의 청산</Button></div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
    {run && <StrategyMonitor plan={view.plan} monitoring={run.monitoring} history={[]} sourceType={view.source.type} showAutoControls={Boolean(run.mode === "FORWARD" && view.source.type === "binance" && canProgress)} showAbortControls={false} onAbort={(reason) => onAction("abort", reason)} onStart={() => onAuto("forward", true)} onStop={() => onAuto("forward", false)} autoMonitoring={watching} pending={pending} error={error} />}
    {run && <section className={styles.card} aria-label="실행 평가"><h2>실행 평가</h2><div className={styles.metricGrid}><div className={styles.metric}><span>관측 봉</span><strong>{run.observedCount}</strong></div><div className={styles.metric}><span>실현 손익 · 1단위</span><strong>{number(run.evaluation.realizedPnl)}</strong></div><div className={styles.metric}><span>실현 R</span><strong>{number(run.evaluation.realizedR, "R")}</strong></div><div className={styles.metric}><span>미실현 손익</span><strong>{number(run.evaluation.unrealizedPnl)}</strong></div><div className={styles.metric}><span>미실현 R</span><strong>{number(run.evaluation.liveR, "R")}</strong></div></div><p className={styles.hint}>상태 {run.evaluation.status} · 진입 {number(run.evaluation.entryPrice)} · 청산 {number(run.evaluation.exitPrice)} · 관측 {utc(run.evaluation.observedThrough)}</p>{run.evaluation.indeterminate && <p className={styles.notice}>봉 안의 선후가 불명확하여 결과를 확정하지 않았습니다.</p>}{run.controlStatus === "COMPLETED" && run.monitoring.status === "OPEN" && <p className={styles.notice}>관측 구간이 끝났지만 포지션은 열린 상태입니다. 마지막 종가 기준 미실현 결과만 표시합니다.</p>}<p className={styles.hint}>단일 실행 결과는 반복 표본의 승률이나 전략 수익성을 뜻하지 않습니다.</p></section>}
    <section className={styles.card}><h2>계획 개정과 내보내기</h2><p className={styles.hint}>새 revision은 현재 공개 가능한 데이터에서 다시 확인합니다. 이전 계획과 실행 기록은 보존됩니다.</p>{view.status === "CONFIRMED" && <div className={styles.form}><label>새 검증 방식<select aria-label="새 검증 방식" value={reviseMode} onChange={(event) => { const next = event.target.value as StrategyMode; setReviseMode(next); if (next === "BACKTEST" && view.mode !== "BACKTEST" && view.source.type === "binance") setReviseCutoff(suggestedCutoff(view.source.interval)); }}><option value="BACKTEST">백테스트</option><option value="FORWARD">포워드 테스트</option></select></label>{reviseMode === "BACKTEST" && view.mode !== "BACKTEST" && view.source.type === "binance" && <label>새 과거 기준 봉 시작 시각 <small>현지 시간 · 필수</small><input type="datetime-local" aria-label="새 과거 기준 봉 시작 시각" value={reviseCutoff} onChange={(event) => setReviseCutoff(event.target.value)} required /></label>}{reviseMode === "BACKTEST" && view.mode !== "BACKTEST" && view.source.type === "dummy" && <label>새 더미 기준 봉<select aria-label="새 더미 기준 봉" value={selectedDummyRevise?.asOf ?? ""} onChange={(event) => setDummyReviseAsOf(Number(event.target.value))}>{dummyCutoffs.filter((option) => option.maxBacktestBars >= view.backtestBars).map((option) => <option key={option.asOf} value={option.asOf}>{option.ordinal}번째 봉 · 후속 {option.maxBacktestBars}봉</option>)}</select><small>기존 관측 봉 수 {view.backtestBars}개를 확보할 수 있는 기준만 표시합니다.</small></label>}</div>}<div className={styles.actions}>{view.status === "CONFIRMED" && <Button variant="secondary" onClick={() => onAction("revise", reviseMode, reviseMode === "BACKTEST" && view.mode !== "BACKTEST" ? view.source.type === "binance" && reviseCutoff ? Math.floor(new Date(reviseCutoff).getTime() / 1000) : selectedDummyRevise?.asOf : undefined)} disabled={pending || (reviseMode === "BACKTEST" && view.mode !== "BACKTEST" && (view.source.type === "binance" ? !reviseCutoff : !selectedDummyRevise))}>새 revision 만들기 <RotateCcw size={14} /></Button>}<Button variant="outline" onClick={onExport} disabled={pending}><Download size={14} /> 전체 JSON 내보내기</Button></div></section>
  </div>;
}

export function StrategyDetailView({ strategyId }: { strategyId: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey:["strategy", strategyId], queryFn:() => strategyApi.get(strategyId), retry:false });
  const options = useQuery({ queryKey:["strategy-options"], queryFn:strategyApi.options, retry:false });
  const refetchStrategy = query.refetch;
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [pendingAction, setPendingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [watching, setWatching] = useState(false);
  const busy = useRef(false);
  const current = useRef<StrategyView | null>(null);
  const hydrated = useRef("");
  const view = query.data;
  useEffect(() => { if (view) current.current = view; }, [view]);
  useEffect(() => {
    if (!view) return;
    const key = `${view.id}:${view.plan?.id ?? `draft:${view.snapshotId}:${view.asOf}`}`;
    if (hydrated.current === key) return;
    hydrated.current = key;
    const indices = view.status === "DRAFT" ? view.draftPlan.waveIndices : view.plan?.wavePoints.map((point) => point.candleIndex);
    setSelectedIndices(indices ? [...indices] : []);
  }, [view]);
  useEffect(() => () => { busy.current = false; }, []);

  const update = useCallback((next: StrategyView) => { current.current = next; client.setQueryData(["strategy", strategyId], next); client.invalidateQueries({ queryKey:["strategies"] }); }, [client, strategyId]);
  const execute = useCallback(async (label: string, operation: (value: StrategyView) => Promise<StrategyView>) => {
    if (busy.current || !current.current) return;
    busy.current = true; setPendingAction(label); setActionError("");
    try { const next = await operation(current.current); update(next); if (next.runs.find((run) => run.id === next.activeRunId)?.controlStatus === "COMPLETED") { setPlaying(false); setWatching(false); } }
    catch (error) { setPlaying(false); setWatching(false); setActionError(error instanceof Error ? error.message : "요청에 실패했습니다."); await refetchStrategy(); }
    finally { busy.current = false; setPendingAction(""); }
  }, [update, refetchStrategy]);
  const activeRun = view?.runs.find((run) => run.id === view.activeRunId) ?? null;
  const runId = activeRun?.id;
  useEffect(() => {
    if (!playing || !runId) return;
    const timer = window.setInterval(() => { const value = current.current; const run = value?.runs.find((item) => item.id === runId); if (run && run.controlStatus !== "COMPLETED" && run.controlStatus !== "PAUSED" && run.controlStatus !== "ERROR" && !terminal.has(run.monitoring.status)) void execute("step", (item) => strategyApi.runAction(strategyId, runId, "step", item.version)); else setPlaying(false); }, 850);
    return () => window.clearInterval(timer);
  }, [playing, runId, strategyId, execute]);
  useEffect(() => {
    if (!watching || !runId) return;
    const timer = window.setInterval(() => { const value = current.current; const run = value?.runs.find((item) => item.id === runId); if (run && run.mode === "FORWARD" && run.controlStatus !== "PAUSED" && run.controlStatus !== "COMPLETED" && run.controlStatus !== "ERROR") void execute("poll", (item) => strategyApi.runAction(strategyId, runId, "poll", item.version)); else setWatching(false); }, 60_000);
    return () => window.clearInterval(timer);
  }, [watching, runId, strategyId, execute]);
  function action(kind: "start" | "step" | "batch" | "poll" | "pause" | "resume" | "abort" | "revise", detail?: string, asOf?: number) {
    if (kind === "revise") { setPlaying(false); setWatching(false); void execute("revise", (item) => strategyApi.revise(strategyId, { expectedVersion:item.version, mode:detail as StrategyMode, ...(asOf === undefined ? {} : { asOf }) })); return; }
    if (kind === "start") { setPlaying(false); setWatching(false); void execute("start", (item) => strategyApi.startRun(strategyId, item.version, item.mode)); return; }
    if (!runId) return;
    if (kind === "pause" || kind === "abort") { setPlaying(false); setWatching(false); }
    if (kind === "abort") { if (!detail || detail.trim().length < 3) { setActionError("중단 이유를 세 글자 이상 입력하세요."); return; } void execute("abort", (item) => strategyApi.abort(strategyId, runId, item.version, detail.trim())); return; }
    void execute(kind, (item) => strategyApi.runAction(strategyId, runId, kind, item.version));
  }
  function auto(kind: "backtest" | "forward", enabled: boolean) {
    if (kind === "backtest") { setPlaying(enabled); return; }
    setWatching(enabled);
    if (enabled) action("poll");
  }
  async function exportJson() {
    setActionError("");
    try { const value = await strategyApi.export(strategyId); const blob = new Blob([JSON.stringify(value, null, 2)], { type:"application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `strategy-${strategyId}.json`; anchor.click(); URL.revokeObjectURL(url); }
    catch (error) { setActionError(error instanceof Error ? error.message : "내보내기에 실패했습니다."); }
  }
  return <StrategyShell crumb={view?.title ?? "전략 상세"}>{query.isPending ? <div className={styles.card} role="status">전략을 불러오는 중입니다.</div> : query.isError || !view ? <div className={styles.error} role="alert">{query.error?.message ?? "전략을 찾을 수 없습니다."} <Button asChild variant="secondary"><Link href="/monitoring">목록으로</Link></Button></div> : <>
    <StrategyIntro title={view.title} description={`${modeName(view.mode)} · ${view.dataset.label} · ${view.status === "DRAFT" ? "저장된 초안" : "확정된 계획"}`} action={<Button asChild variant="secondary"><Link href="/monitoring"><ArrowLeft size={14} /> 전략 목록</Link></Button>} />
    <div className={styles.meta}><span className={styles.pill}>기준 {utc(view.asOf)}</span><span className={styles.pill}>공개 {view.visibleCandles.length}봉</span><span className={styles.pill}>계획 {view.plans.length}개 · 실행 {view.runs.length}개</span><span className={styles.pill}>{view.dataset.kind}</span></div>
    <div className={styles.grid}><div className={styles.column}><ChartWorkspace candles={view.visibleCandles} selectedIndices={selectedIndices} showFibonacci={selectedIndices.length === 3} plan={view.plan} monitoring={activeRun?.monitoring} selectionCount={3} sourceLabel={view.dataset.label} title="파동 기준점 선택" description="공개된 확정봉에서 시작점·1파·2파를 시간순으로 선택합니다." onSelect={(index) => setSelectedIndices((list) => list.length < 3 && (list.length === 0 || index > list[list.length - 1]) ? [...list, index] : list)} onUndo={() => setSelectedIndices((list) => list.slice(0, -1))} onReset={() => setSelectedIndices([])} disabled={view.status !== "DRAFT" || Boolean(pendingAction)} />
      {view.status === "DRAFT" ? <><PlanDraftForm key={`${view.id}:${view.version}`} view={view} selectedIndices={selectedIndices} pending={Boolean(pendingAction)} error={actionError} onSave={(draftPlan) => void execute("save", (item) => strategyApi.update(strategyId, { expectedVersion:item.version, draftPlan }))} onConfirm={(input: Omit<StrategyConfirmInput, "expectedVersion">) => void execute("confirm", (item) => strategyApi.confirm(strategyId, { ...input, expectedVersion:item.version }))} />{view.source.type === "binance" && view.mode === "FORWARD" && <section className={styles.card}><h2>최신 기준으로 다시 확인</h2><p className={styles.hint}>초안 작성 중 새 봉이 마감되었다면 현재 최신 확정봉으로 기준을 갱신합니다. 파동 선택은 다시 확인해야 합니다.</p><Button variant="secondary" onClick={() => { setSelectedIndices([]); void execute("refresh", (item) => strategyApi.update(strategyId, { expectedVersion:item.version, refreshData:true })); }} disabled={Boolean(pendingAction)}>최신 확정봉으로 초안 갱신</Button></section>}</> : <PlanRecord view={view} />}
      <section className={styles.card}><h2>계획 revision · 실행 이력</h2>{view.plans.length === 0 ? <p className={styles.muted}>확정 계획이 아직 없습니다.</p> : <div className={styles.history}>{view.plans.map((plan) => <details className={styles.historyItem} key={plan.id} open={plan.id === view.plan?.id}><summary>revision {plan.revision} · {modeName(plan.mode)} · {utc(plan.asOf)} · {plan.id.slice(0,8)}</summary><p>진입 {number(plan.entry)} · 손절 {number(plan.stopLoss)} · 목표 {number(plan.target)} · 무효화 {number(plan.monitoringConfig.rule.level)}</p>{view.runs.filter((run) => run.planId === plan.id).map((run) => <details key={run.id} className={styles.historyItem}><summary>{runLine(run)} · {run.id.slice(0,8)}</summary><p>출처 {run.source.type === "dummy" ? "더미 시뮬레이션" : `${run.source.symbol} ${run.source.interval} Binance`} · 데이터 기간 {utc(run.dataRange.startTime)} ~ {utc(run.dataRange.endTime)} · 시작 {run.startedAt} · 마지막 관측 {utc(run.monitoring.observedThrough)} · 종료 {run.endedAt ?? "—"}</p><p>기준 스냅샷 {run.snapshotId} · 관측 스냅샷 {run.observedSnapshotId} · touch-v1 · 수량 1 · 비용 0</p><p>진입 {number(run.evaluation.entryPrice)} · 청산 {number(run.evaluation.exitPrice)} · 실현 {number(run.evaluation.realizedPnl)} / {number(run.evaluation.realizedR, "R")} · 미실현 {number(run.evaluation.unrealizedPnl)} / {number(run.evaluation.liveR, "R")}</p>{run.evaluation.indeterminate && <p>OHLC 봉 내부의 체결 순서는 판정할 수 없습니다.</p>}<ol>{run.monitoring.events.map((event) => <li key={event.id}>{utc(event.candleTime)} · {event.kind} · {event.reason}{event.price != null && ` · ${number(event.price)}`}</li>)}</ol></details>)}</details>)}</div>}</section>
      {view.runs.length > 1 && <section className={`${styles.card} ${styles.compare}`}><h2>실행별 결과 비교</h2><table><thead><tr><th>실행</th><th>방식</th><th>관측</th><th>상태</th><th>실현 R</th><th>미실현 R</th></tr></thead><tbody>{view.runs.map((run) => <tr key={run.id}><td>{run.id.slice(0,8)}</td><td>{modeName(run.mode)}</td><td>{run.observedCount}봉 · {utc(run.monitoring.observedThrough)}</td><td>{run.monitoring.status}</td><td>{number(run.evaluation.realizedR, "R")}</td><td>{number(run.evaluation.liveR, "R")}</td></tr>)}</tbody></table></section>}
    </div><RunPanel view={view} run={activeRun} pending={Boolean(pendingAction)} error={actionError} watching={watching} playing={playing} dummyCutoffs={options.data?.dummyCutoffs ?? []} onAction={action} onAuto={auto} onExport={() => void exportJson()} /></div>
  </>}</StrategyShell>;
}
