"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronRight, Download, Pause, Play, RotateCcw, Sparkles, TrendingUp } from "lucide-react";
import type { SessionView } from "@/entities/tutorial";
import { tutorialApi, type SourceSelection } from "./api";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { useWaveDraft, WaveValidationPreview } from "@/features/count-waves";
import { TradePlanPanel, type PlanInput } from "@/features/confirm-trade-plan";
import { TutorialSidebar } from "@/widgets/tutorial-sidebar";
import { ChartWorkspace } from "@/widgets/chart-workspace";
import { EvaluationPanel } from "@/widgets/evaluation-panel";
import { StrategyMonitor } from "@/widgets/strategy-monitor";
import { TutorialError, TutorialLoading } from "./status";
import { AdvancedLesson } from "./advanced";

function sessionStorageKey(unitId: string) { return `fibonacci-tutorial:session:${unitId}`; }
function rememberSession(unitId: string, sessionId: string) {
  try { window.localStorage.setItem(sessionStorageKey(unitId), sessionId); } catch { /* URL still restores the session. */ }
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  window.history.replaceState(null, "", url);
}
function sourceName(source: SessionView["source"]) { return source.type === "dummy" ? "시뮬레이션 데이터" : `${source.symbol} · ${source.interval} · Binance`; }

function subscribeProgress(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
function readProgress() {
  try { return window.localStorage.getItem("fibonacci-tutorial:completed") || "[]"; } catch { return "[]"; }
}
function parseProgress(raw: string): string[] {
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []; } catch { return []; }
}

export function TutorialView({ unitId }: { unitId: string }) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startupError, setStartupError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [autoMonitoring, setAutoMonitoring] = useState(false);
  const [monitorError, setMonitorError] = useState("");
  const [advancedPending, setAdvancedPending] = useState(false);
  const [advancedError, setAdvancedError] = useState("");
  const [completedUnitIds, setCompletedUnitIds] = useState<string[]>([]);
  const savedProgress = useSyncExternalStore(subscribeProgress, readProgress, () => "[]");
  const [draftSource, setSource] = useState<SourceSelection | null>(null);
  const [sourceDate, setSourceDate] = useState<string | null>(null);
  const startupUnit = useRef<string | null>(null);
  const hydratedSession = useRef<string | null>(null);
  const mismatchHandled = useRef<string | null>(null);
  const replayBusy = useRef(false);
  const monitorBusy = useRef(false);
  const waveIndices = useWaveDraft((state) => state.waveIndices);
  const chooseCandle = useWaveDraft((state) => state.chooseCandle);
  const undo = useWaveDraft((state) => state.undo);
  const resetWaves = useWaveDraft((state) => state.reset);
  const hydrateFromPlan = useWaveDraft((state) => state.hydrateFromPlan);
  const setMaxPoints = useWaveDraft((state) => state.setMaxPoints);

  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: tutorialApi.catalog });
  const sessionQuery = useQuery({ queryKey: ["session", unitId, sessionId], queryFn: () => tutorialApi.session(sessionId!), enabled: Boolean(sessionId), retry: false });
  const session = sessionQuery.data?.unitId === unitId ? sessionQuery.data : undefined;
  const source: SourceSelection = draftSource ?? session?.source ?? { type: "dummy" };
  const selectedDate = sourceDate ?? (source.type === "binance" && source.startTime !== undefined ? new Date(source.startTime).toISOString().slice(0, 10) : "");
  useEffect(() => {
    if (!sessionQuery.data || sessionQuery.data.unitId === unitId || mismatchHandled.current === sessionQuery.data.id) return;
    mismatchHandled.current = sessionQuery.data.id;
    tutorialApi.createSession(unitId).then((created) => {
      if (startupUnit.current !== unitId) return;
      queryClient.setQueryData(["session", unitId, created.id], created);
      rememberSession(unitId, created.id);
      setSessionId(created.id);
    }).catch((error: Error) => setStartupError(error.message));
  }, [sessionQuery.data, unitId, queryClient]);
  const unit = session?.unit || catalogQuery.data?.chapters.flatMap((chapter) => chapter.units).find((candidate) => candidate.id === unitId);

  useEffect(() => {
    if (startupUnit.current === unitId) return;
    startupUnit.current = unitId;
    setPlaying(false);
    setAutoMonitoring(false);
    setSessionId(null);
    setStartupError("");
    hydratedSession.current = null;
    mismatchHandled.current = null;
    resetWaves();
    const fromUrl = new URL(window.location.href).searchParams.get("session");
    let fromStorage: string | null = null;
    try { fromStorage = window.localStorage.getItem(sessionStorageKey(unitId)); } catch { /* URL remains available. */ }
    const existing = fromUrl || fromStorage;
    if (existing) { setSessionId(existing); return; }
    tutorialApi.createSession(unitId).then((created) => {
      if (startupUnit.current !== unitId) return;
      queryClient.setQueryData(["session", unitId, created.id], created);
      rememberSession(unitId, created.id);
      setSessionId(created.id);
    }).catch((error: Error) => { if (startupUnit.current === unitId) setStartupError(error.message); });
  }, [queryClient, unitId, resetWaves]);
  useEffect(() => {
    if (!session || hydratedSession.current === session.id) return;
    if (session.complete) window.setTimeout(() => setCompletedUnitIds((current) => [...new Set([...current, session.unitId])]), 0);
    hydratedSession.current = session.id;
    setMaxPoints(session.unit?.selectionCount ?? 3);
    if (session.selectedIndices.length) hydrateFromPlan(session.selectedIndices);
    else if (session.plan) hydrateFromPlan(session.plan.wavePoints.map((point) => point.candleIndex));
    else resetWaves();
  }, [session, hydrateFromPlan, resetWaves, setMaxPoints]);

  function updateSession(updated: SessionView) {
    if (!updated.plan) setPlaying(false);
    if (updated.complete) { setPlaying(false); setCompletedUnitIds((current) => { const next = [...new Set([...parseProgress(readProgress()), ...current, updated.unitId])]; try { window.localStorage.setItem("fibonacci-tutorial:completed", JSON.stringify(next)); } catch { /* UI continues without storage. */ } return next; }); }
    queryClient.setQueryData(["session", unitId, updated.id], updated);
    if (updated.selectedIndices.length) hydrateFromPlan(updated.selectedIndices);
  }
  function makeMutation<T>(fn: (input: T) => Promise<SessionView>) {
    return { mutationFn: fn, onSuccess: updateSession, onError: () => { setPlaying(false); sessionQuery.refetch(); } };
  }
  const confirmMutation = useMutation(makeMutation((input: PlanInput) => tutorialApi.confirmPlan(sessionId!, input)));
  const advanceMutation = useMutation(makeMutation((input: { step: number; direction: "next" | "prev" }) => tutorialApi.advance(sessionId!, input.step, input.direction)));
  const checkMutation = useMutation(makeMutation((indices: number[]) => tutorialApi.check(sessionId!, indices)));
  const hintMutation = useMutation(makeMutation((kind: "hint" | "example") => tutorialApi.hint(sessionId!, kind)));
  const reviseMutation = useMutation(makeMutation((planId: string) => tutorialApi.revise(sessionId!, planId)));
  const replayMutation = useMutation(makeMutation((cursor: number) => tutorialApi.revealCandle(sessionId!, cursor)));
  const evaluateMutation = useMutation(makeMutation(() => tutorialApi.evaluate(sessionId!)));
  const evaluateForMonitoring = evaluateMutation.mutateAsync;
  const reflectionMutation = useMutation(makeMutation((input: { decision: "close" | "hold"; reason: string }) => tutorialApi.reflect(sessionId!, input)));
  const abortMutation = useMutation(makeMutation((input: { planId: string; cursor: number; reason: string }) => tutorialApi.abortMonitoring(sessionId!, input.planId, input.cursor, input.reason)));
  const newSessionMutation = useMutation({
    onMutate: () => { setPlaying(false); setAutoMonitoring(false); },
    mutationFn: (selected: SourceSelection) => tutorialApi.createSession(unitId, selected),
    onSuccess: (created) => {
      queryClient.setQueryData(["session", unitId, created.id], created);
      hydratedSession.current = null;
      resetWaves();
      rememberSession(unitId, created.id);
      setSessionId(created.id);
      setPlaying(false);
      setStartupError("");
      for (const mutation of [confirmMutation, advanceMutation, checkMutation, hintMutation, reviseMutation, replayMutation, evaluateMutation, reflectionMutation, abortMutation]) mutation.reset();
    },
  });
  useEffect(() => {
    if (!playing || !session || session.complete || session.cursor >= session.totalCandles - 1 || !session.plan) return;
    const timer = window.setTimeout(async () => {
      if (replayBusy.current) return;
      replayBusy.current = true;
      try { await replayMutation.mutateAsync(session.cursor); } catch { setPlaying(false); }
      finally { replayBusy.current = false; }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [playing, session, replayMutation]);
  useEffect(() => () => setPlaying(false), [unitId]);
  const monitorSource = session?.source.type;
  const monitorPlanId = session?.plan?.id;
  const monitorStatus = session?.monitoring?.status;
  useEffect(() => {
    if (!autoMonitoring || !sessionId || monitorSource !== "binance" || !monitorPlanId || !monitorStatus || ["CLOSED_TP", "CLOSED_SL", "INVALIDATED_STOP", "EXPIRED", "ABORTED", "INDETERMINATE"].includes(monitorStatus)) return;
    let stopped = false;
    const tick = async () => {
      if (monitorBusy.current || stopped) return;
      monitorBusy.current = true;
      try { await evaluateForMonitoring(); if (!stopped) setMonitorError(""); }
      catch (error) { if (!stopped) { setMonitorError(error instanceof Error ? error.message : "확정봉 조회에 실패했습니다."); setAutoMonitoring(false); } }
      finally { monitorBusy.current = false; }
    };
    const timer = window.setInterval(() => { void tick(); }, 60_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [autoMonitoring, sessionId, monitorSource, monitorPlanId, monitorStatus, evaluateForMonitoring]);

  function selectedSource(): SourceSelection {
    if (source.type === "dummy") return source;
    return { ...source, ...(selectedDate ? { startTime: Date.parse(`${selectedDate}T00:00:00.000Z`) } : {}) };
  }
  const loading = (!sessionId && !startupError) || Boolean(sessionId && sessionQuery.isPending);
  const loadError = startupError || (sessionQuery.error as Error | null)?.message || (sessionQuery.data && !session ? "다른 유닛의 세션입니다. 새 연습을 시작하세요." : "");
  const actionError = [confirmMutation, advanceMutation, checkMutation, hintMutation, reviseMutation, replayMutation, evaluateMutation, reflectionMutation, abortMutation].find((mutation) => mutation.error)?.error?.message;
  const pending = [confirmMutation, advanceMutation, checkMutation, hintMutation, reviseMutation, replayMutation, evaluateMutation, reflectionMutation, abortMutation].some((mutation) => mutation.isPending);
  return <div className="app-shell">
    <TutorialSidebar catalog={catalogQuery.data} activeUnitId={unitId} completedUnitIds={[...new Set([...parseProgress(savedProgress), ...completedUnitIds])]} />
    <main className="main-content"><header className="topbar"><div className="breadcrumb">튜토리얼 <ChevronRight size={14} /> <span>{unit?.title || "학습 유닛"}</span></div><div className="topbar-right"><span className="topbar-status"><span className="live-dot" /> 학습 중</span><div className="avatar">FL</div></div></header>
      <div className="page-content"><div className="hero"><div className="hero-copy"><div className="hero-kicker"><Sparkles size={14} /> INTERACTIVE LESSON</div><h1>{unit?.title || "Fibonacci Lab"} <em>직접 읽고 판단하세요</em></h1><p>{unit?.description || "차트와 함께 파동을 학습합니다."}</p></div><div className="hero-art" aria-hidden="true"><span className="art-line" /><span className="art-point art-point-1">0</span><span className="art-point art-point-2">1</span><span className="art-point art-point-3">2</span><span className="art-point art-point-4">3?</span><TrendingUp className="art-icon" size={32} /></div></div>
        {unit && <div className="lesson-strip"><div className="lesson-strip-number">{unit.task === "theory" ? "T" : unit.selectionCount}</div><div><strong>{unit.title}</strong><span>{unit.completionCriteria}</span></div><div className="lesson-strip-progress">{session?.complete ? "완료" : unit.task === "theory" ? `단계 ${(session?.theoryStep ?? 0) + 1} / ${session?.theoryStepCount || 1}` : session?.plan ? "Replay 진행 중" : "학습 중"}</div></div>}
        {(unitId === "market-lab" || unitId === "ew-live-followup") && <Card className="source-panel"><h2>데이터 소스</h2><p className="panel-description">새 세션을 시작할 때 소스를 선택합니다. 현재 세션: {session ? sourceName(session.source) : "불러오는 중"}</p><div className="source-fields"><label>소스<select aria-label="데이터 소스" value={source.type} onChange={(event) => setSource(event.target.value === "dummy" ? { type: "dummy" } : { type: "binance", symbol: "BTCUSDT", interval: "1h" })}><option value="dummy">재현 가능한 더미</option><option value="binance">Binance 확정봉</option></select></label>{source.type === "binance" && <><label>심볼<select aria-label="심볼" value={source.symbol} onChange={(event) => setSource({ ...source, symbol: event.target.value as "BTCUSDT" | "ETHUSDT" })}><option>BTCUSDT</option><option>ETHUSDT</option></select></label><label>간격<select aria-label="간격" value={source.interval} onChange={(event) => setSource({ ...source, interval: event.target.value as "1h" | "4h" | "1d" })}><option value="1h">1h</option><option value="4h">4h</option><option value="1d">1d</option></select></label><label>시작일 UTC<input type="date" aria-label="시작일 UTC" value={selectedDate} onChange={(event) => setSourceDate(event.target.value)} /></label></>}<Button variant="secondary" onClick={() => newSessionMutation.mutate(selectedSource())} disabled={pending || newSessionMutation.isPending}>선택한 소스로 새 세션</Button></div></Card>}
        {catalogQuery.isError && <div className="notice error" role="alert">학습 목록을 불러오지 못했습니다. 새로고침해 주세요.</div>}
        {loadError && <TutorialError message={loadError} onNewSession={() => newSessionMutation.mutate(selectedSource())} pending={newSessionMutation.isPending} />}
        {newSessionMutation.isError && <div className="notice error" role="alert">{newSessionMutation.error.message}</div>}
        {loading && <TutorialLoading />}
        {session && (session.learning ? <AdvancedLesson key={`${session.id}-${session.learning?.currentCase?.id ?? "theory"}`} session={session} update={updateSession} pending={advancedPending} setPending={setAdvancedPending} actionError={advancedError} setActionError={setAdvancedError} /> : <TutorialWorkspace key={session.id} session={session} waveIndices={waveIndices} chooseCandle={chooseCandle} undo={undo} reset={resetWaves} confirm={(input) => confirmMutation.mutate(input)} advance={() => advanceMutation.mutate({ step: session.theoryStep, direction: "next" })} prev={() => advanceMutation.mutate({ step: session.theoryStep, direction: "prev" })} check={() => checkMutation.mutate(waveIndices)} hint={(kind) => hintMutation.mutate(kind)} revise={() => { setPlaying(false); setAutoMonitoring(false); if (session.plan) reviseMutation.mutate(session.plan.id); }} replay={() => replayMutation.mutate(session.cursor)} evaluate={() => { setPlaying(false); evaluateMutation.mutate(); }} reflect={(input) => reflectionMutation.mutate(input)} abortMonitoring={(reason) => { if (session.plan) { setAutoMonitoring(false); abortMutation.mutate({ planId: session.plan.id, cursor: session.cursor, reason }); } }} startMonitoring={() => { setMonitorError(""); setAutoMonitoring(true); void evaluateMutation.mutateAsync().catch((error: Error) => { setMonitorError(error.message); setAutoMonitoring(false); }); }} stopMonitoring={() => setAutoMonitoring(false)} autoMonitoring={autoMonitoring} monitorError={monitorError} playing={playing} setPlaying={setPlaying} pending={pending || newSessionMutation.isPending} actionError={actionError} />)}
        {session && <div className="page-footer"><span>Fibonacci Lab · 한 캔들씩, 더 분명한 판단으로.</span><div><a href={tutorialApi.exportUrl(session.id)} download={`fibonacci-${unitId}-${session.id}.json`} className="footer-export"><Download size={13} /> JSON 내보내기</a><Button variant="ghost" size="sm" onClick={() => newSessionMutation.mutate(session.source)} disabled={pending || newSessionMutation.isPending}><RotateCcw size={14} /> 새 연습 시작</Button></div></div>}
      </div>
    </main>
  </div>;
}

export function TutorialWorkspace({ session, waveIndices, chooseCandle, undo, reset, confirm, advance, prev, check, hint, revise, replay, evaluate, reflect, abortMonitoring, startMonitoring, stopMonitoring, autoMonitoring, monitorError, playing, setPlaying, pending, actionError }: {
  session: SessionView; waveIndices: number[]; chooseCandle: (index: number) => void; undo: () => void; reset: () => void;
  confirm: (input: PlanInput) => void; advance: () => void; prev: () => void; check: () => void; hint: (kind: "hint" | "example") => void; revise: () => void; replay: () => void; evaluate: () => void; reflect: (input: { decision: "close" | "hold"; reason: string }) => void;
  abortMonitoring?: (reason: string) => void; startMonitoring?: () => void; stopMonitoring?: () => void; autoMonitoring?: boolean; monitorError?: string;
  playing: boolean; setPlaying: (value: boolean) => void; pending: boolean; actionError?: string;
}) {
  const [decision, setDecision] = useState<"close" | "hold">("close");
  const [reason, setReason] = useState("");
  const unit = session.unit;
  const instruction = session.instruction ?? { title: unit?.title || "차트를 살펴보세요", description: unit?.description || "공개된 캔들을 확인하세요.", showFibonacci: false };
  const task = unit?.task || "trade";
  const trade = task === "trade";
  const theory = task === "theory";
  const selectionDisabled = theory || session.complete || Boolean(session.plan) || pending || playing;
  const example = theory ? null : session.exampleIndices;
  const fibonacci = instruction.showFibonacci || task === "fibonacci" || (trade && (waveIndices.length >= 3 || Boolean(session.plan)));
  const source = sourceName(session.source);
  const basePrice = session.visibleCandles.at(-1)?.close ?? 114;
  const defaultEntry = session.unitId === "wave-three" && session.source.type === "dummy" ? 114 : Number((basePrice * 1.002).toFixed(2));
  const defaultStop = session.unitId === "wave-three" && session.source.type === "dummy" ? 99 : Number((basePrice * .98).toFixed(2));
  const defaultTarget = session.unitId === "wave-three" && session.source.type === "dummy" ? 142.36 : Number((basePrice * 1.04).toFixed(2));
  const canReflect = trade && (session.complete || session.evaluations.some((item) => item.planId === session.plan?.id && item.evaluationMode === "later-market" && item.observedThrough > session.plan.asOf));
  return <div className="workspace-grid"><div className="workspace-main"><ChartWorkspace candles={session.visibleCandles} selectedIndices={waveIndices} exampleIndices={example} showFibonacci={fibonacci} plan={session.plan} monitoring={session.monitoring} selectionCount={unit?.selectionCount ?? 3} sourceLabel={source} title={instruction.title} description={instruction.description} onSelect={chooseCandle} onUndo={undo} onReset={reset} disabled={selectionDisabled} />
    {task === "count" && !session.complete && <WaveValidationPreview candles={session.visibleCandles} indices={waveIndices} />}
    {theory ? <Card className="lesson-actions"><div className="replay-copy"><span className="replay-icon"><ArrowRight size={19} /></span><div><strong>이론 단계 {(session.theoryStep ?? 0) + 1} / {session.theoryStepCount}</strong><span>설명과 차트 공개 범위가 함께 진행됩니다.</span></div></div><div className="replay-buttons"><Button variant="secondary" onClick={prev} disabled={pending || session.theoryStep === 0}><ArrowLeft size={16} /> Prev</Button><Button onClick={advance} disabled={pending || session.complete}>Next <ArrowRight size={16} /></Button></div></Card> : trade ? <div className="replay-panel"><div className="replay-copy"><span className="replay-icon"><ArrowRight size={19} /></span><div><strong>다음 캔들 보기</strong><span>{session.plan ? session.complete ? "모든 캔들을 확인했습니다." : "한 캔들씩 공개하며 판단을 검증합니다." : "계획을 확정하면 Replay를 시작할 수 있습니다."}</span></div></div><div className="replay-buttons"><Button variant="secondary" onClick={() => setPlaying(!playing)} disabled={!session.plan || session.complete || session.cursor >= session.totalCandles - 1 || (pending && !playing)}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? "Pause" : "Play"}</Button><Button onClick={replay} disabled={!session.plan || session.complete || session.cursor >= session.totalCandles - 1 || pending || playing}>Next Candle <ArrowRight size={16} /></Button></div></div> : <Card className="lesson-actions"><div className="replay-copy"><span className="replay-icon"><ArrowRight size={19} /></span><div><strong>선택 검증</strong><span>{unit?.selectionCount ?? 3}개 지점을 고르고 규칙별 피드백을 확인하세요.</span></div></div><Button onClick={check} disabled={waveIndices.length !== (unit?.selectionCount ?? 3) || pending || session.complete}>Check Answer</Button><Button variant="secondary" onClick={() => hint("hint")} disabled={pending}>Show Hint</Button><Button variant="outline" onClick={() => hint("example")} disabled={pending || session.validation.length === 0}>Show Example</Button></Card>}
    {trade && session.complete && <Button variant="outline" onClick={() => hint("example")} disabled={pending}>Show Example</Button>}
    {actionError && <p className="form-error" role="alert">{actionError}</p>}
    {(session.validation.length > 0 || session.hint || session.exampleIndices) && <Card className="lesson-feedback"><h2>학습 피드백</h2>{session.validation.map((item, index) => <div key={`${item.rule}-${index}`} className={`feedback-item ${item.pass ? "pass" : "fail"}`}><strong>{item.pass ? "✓" : "!"} {item.rule}</strong><span>{item.reason}</span></div>)}{session.hint && <p><strong>힌트:</strong> {session.hint}</p>}{session.exampleIndices && <p>예시 파동: {session.exampleIndices.map((index, wave) => `W${wave} ${index + 1}번째 캔들`).join(" → ")}</p>}</Card>}
    {canReflect && <Card className="lesson-feedback"><h2>관찰 후 청산 판단</h2><p>결과를 보고 유지 또는 청산을 판단하고 이유를 남겨보세요. 이미 기록된 모의 체결 결과는 바뀌지 않습니다.</p>{session.reflection ? <div className="feedback-item pass"><strong>{session.reflection.decision === "close" ? "청산" : "유지"}</strong><span>{session.reflection.reason}</span></div> : <form className="reflection-form" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) reflect({ decision, reason: reason.trim() }); }}><label>판단<select value={decision} onChange={(event) => setDecision(event.target.value as "close" | "hold")}><option value="close">청산</option><option value="hold">유지</option></select></label><label>판단 이유<textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={2000} /></label><Button type="submit" disabled={pending || reason.trim().length < 3}>판단 저장</Button></form>}</Card>}
  </div><div className="workspace-side">{trade && <TradePlanPanel key={`${session.id}-${session.plans.length}-${session.plan?.id || "draft"}`} waveIndices={waveIndices} plan={session.plan} onConfirm={confirm} onRevise={session.complete && session.source.type === "dummy" ? undefined : revise} pending={pending} error={actionError} defaultEntry={defaultEntry} defaultStopLoss={defaultStop} defaultTarget={defaultTarget} visibleCount={session.visibleCandles.length} visibleCandles={session.visibleCandles} />}{trade && <StrategyMonitor plan={session.plan} monitoring={session.monitoring} history={session.monitoringHistory} sourceType={session.source.type} onAbort={abortMonitoring ?? (() => {})} onStart={startMonitoring ?? (() => {})} onStop={stopMonitoring ?? (() => {})} autoMonitoring={Boolean(autoMonitoring)} pending={pending} error={monitorError || actionError} />}{trade && <EvaluationPanel plan={session.plan} evaluation={session.evaluations.filter((item) => item.planId === session.plan?.id).at(-1)} revealed={session.visibleCandles.length} total={session.totalCandles} />}{trade && session.source.type === "binance" && <Card className="lesson-actions"><div><strong>시간 경과 후 시장 평가</strong><p className="panel-description">새 확정봉을 조회해 계획 이후 움직임을 다시 평가합니다.</p></div><Button onClick={evaluate} disabled={!session.plan || pending}>이후 시장 평가</Button></Card>}{trade && <Card className="history-card"><h2>계획과 평가 이력</h2>{session.plans.length ? session.plans.map((plan) => <details key={plan.id} className="history-item" open={plan.id === session.plan?.id}><summary><strong>계획 v{plan.revision} · {plan.entry.toFixed(2)} → {plan.target.toFixed(2)}</strong></summary><small>기준: {new Date(plan.asOf * 1000).toLocaleString("ko-KR", { timeZone: "UTC" })} UTC</small><span>손절 {plan.stopLoss.toFixed(2)} · 무효화 {plan.invalidationPrice?.toFixed(2) ?? "—"}</span><span>판단: {plan.rationale}</span><span>청산 전략: {plan.exitStrategy}</span>{session.evaluations.filter((evaluation) => evaluation.planId === plan.id).map((evaluation) => <span key={evaluation.id}>{evaluation.evaluationMode === "later-market" ? "사후 시장" : "Replay"} · {evaluation.status} · {evaluation.resultR === null ? "—" : `${evaluation.resultR.toFixed(2)}R`}</span>)}</details>) : <p className="panel-description">확정된 계획이 없습니다.</p>}</Card>}</div></div>;
}
