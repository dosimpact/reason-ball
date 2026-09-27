"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import type { StrategyDraftInput, StrategyMode } from "@/entities/strategy";
import { Button } from "@/shared/ui/button";
import { strategyApi } from "./api";
import { StrategyIntro, StrategyShell, suggestedCutoff } from "./shared";
import styles from "./strategy-workspace.module.css";

export function StrategyNewView() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<StrategyMode>("BACKTEST");
  const [source, setSource] = useState<"dummy" | "binance">("dummy");
  const [symbol, setSymbol] = useState<"BTCUSDT" | "ETHUSDT">("BTCUSDT");
  const [interval, setInterval] = useState<"1h" | "4h" | "1d">("1h");
  const [cutoff, setCutoff] = useState("");
  const [dummyAsOf, setDummyAsOf] = useState<number | null>(null);
  const [backtestBars, setBacktestBars] = useState("4");
  const options = useQuery({ queryKey:["strategy-options"], queryFn:strategyApi.options, retry:false });
  const dummyCutoffs = options.data?.dummyCutoffs ?? [];
  const selectedDummy = dummyCutoffs.find((option) => option.asOf === dummyAsOf) ?? dummyCutoffs.find((option) => option.ordinal === 8) ?? dummyCutoffs[0];
  const create = useMutation({ mutationFn: strategyApi.create, onSuccess: (created) => router.push(`/monitoring/${created.id}`) });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (source === "dummy" && !selectedDummy) return;
    const input: StrategyDraftInput = { title:title.trim(), mode, source:source === "dummy" ? { type:"dummy" } : { type:"binance", symbol, interval }, backtestBars:Number(backtestBars) };
    if (source === "dummy") input.asOf = selectedDummy.asOf;
    if (source === "binance" && mode === "BACKTEST") input.asOf = Math.floor(new Date(cutoff).getTime() / 1000);
    create.mutate(input);
  }
  return <StrategyShell crumb="새 전략"><StrategyIntro title="새 전략 계획" description="데이터와 기준 봉을 선택한 뒤 공개된 차트에서 파동 지점과 매매 기준을 기록합니다." />
    <div className={styles.grid}><section className={styles.card}><h2>1. 검증 방식과 시장</h2><form className={styles.form} onSubmit={submit}>
      <label>전략 이름<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} placeholder="예: BTC 1시간봉 3파 돌파" /></label>
      <div className={styles.formRow}><label>검증 방식<select aria-label="검증 방식" value={mode} onChange={(event) => { const next = event.target.value as StrategyMode; setMode(next); if (next === "BACKTEST" && source === "binance") setCutoff(suggestedCutoff(interval)); if (next === "BACKTEST" && source === "dummy") setBacktestBars(String(Math.min(Number(backtestBars), selectedDummy?.maxBacktestBars ?? 4))); }}><option value="BACKTEST">백테스트 · 과거 구간</option><option value="FORWARD">포워드 테스트 · 새 확정봉</option></select></label><label>데이터 출처<select aria-label="데이터 출처" value={source} onChange={(event) => { const next = event.target.value as typeof source; setSource(next); setBacktestBars(next === "dummy" ? String(Math.min(4, selectedDummy?.maxBacktestBars ?? 4)) : "120"); if (next === "binance" && mode === "BACKTEST") setCutoff(suggestedCutoff(interval)); }}><option value="dummy">더미 시뮬레이션</option><option value="binance">Binance 실제 캔들</option></select></label></div>
      {source === "binance" && <div className={styles.formRow}><label>종목<select aria-label="종목" value={symbol} onChange={(event) => setSymbol(event.target.value as typeof symbol)}><option value="BTCUSDT">BTCUSDT</option><option value="ETHUSDT">ETHUSDT</option></select></label><label>시간봉<select aria-label="시간봉" value={interval} onChange={(event) => { const next = event.target.value as typeof interval; setInterval(next); if (mode === "BACKTEST") setCutoff(suggestedCutoff(next)); }}><option value="1h">1시간</option><option value="4h">4시간</option><option value="1d">일봉</option></select></label></div>}
      {(source === "dummy" || mode === "BACKTEST") && <div className={styles.formRow}>{source === "binance" ? <label>과거 기준 봉 시작 시각 <small>필수 · 현지 시간</small><input type="datetime-local" aria-label="과거 기준 봉 시작 시각" value={cutoff} onChange={(event) => setCutoff(event.target.value)} required /></label> : <label>더미 기준 봉<select aria-label="더미 기준 봉" value={selectedDummy?.asOf ?? ""} onChange={(event) => { const next = dummyCutoffs.find((option) => option.asOf === Number(event.target.value)); setDummyAsOf(next?.asOf ?? null); if (next && Number(backtestBars) > next.maxBacktestBars) setBacktestBars(String(next.maxBacktestBars)); }} disabled={options.isPending || options.isError}>{dummyCutoffs.map((option) => <option key={option.asOf} value={option.asOf}>{option.ordinal}번째 봉 · {new Date(option.asOf * 1000).toISOString().slice(0,16)} UTC · 후속 {option.maxBacktestBars}봉</option>)}</select></label>}{mode === "BACKTEST" && <label>백테스트 관측 봉 수<input type="number" aria-label="백테스트 관측 봉 수" min={1} max={source === "dummy" ? selectedDummy?.maxBacktestBars ?? 1 : 4000} value={backtestBars} onChange={(event) => setBacktestBars(event.target.value)} required /></label>}</div>}
      <p className={styles.hint}>{mode === "BACKTEST" ? "기준 봉 뒤의 OHLC는 계획 확정 전까지 공개하지 않습니다. Binance 시각은 입력 기기의 현지 시간으로 해석되며 시간봉 시작 시각이어야 합니다." : source === "binance" ? "포워드는 계획 확정 시점의 최신 확정봉을 기준으로 삼습니다." : "더미 포워드는 선택한 기준 봉 이후 순차 입력 시뮬레이션이며 실제 시장 관측으로 표시하지 않습니다."}</p>
      {source === "dummy" && options.isError && <p className={styles.error} role="alert">기준 봉 목록을 불러오지 못했습니다. {options.error.message}</p>}
      {create.isError && <p className={styles.error} role="alert">{create.error.message}</p>}
      <div className={styles.formActions}><Button type="submit" disabled={create.isPending || !title.trim() || (source === "dummy" && !selectedDummy)}>{create.isPending ? "초안 저장 중…" : "초안 저장하고 차트 열기"} <ArrowRight size={16} /></Button></div>
    </form></section><aside className={styles.card}><h2>실행 기준</h2><p className={styles.muted}>확정 계획은 수정되지 않습니다. 가격과 파동 근거를 바꾸면 새 revision으로 기록합니다.</p><div className={styles.notice} style={{ marginTop:16 }}><strong>{mode === "BACKTEST" ? "과거 구간 검증" : "새 확정봉 관측"}</strong><p>{mode === "BACKTEST" ? "기준 시점 뒤의 고정된 캔들을 한 봉씩 재생하거나 전체 실행합니다." : "계획 확정 뒤 새로 닫힌 봉을 조회합니다. 더미 데이터는 포워드 동작 시뮬레이션으로 표기합니다."}</p></div></aside></div>
  </StrategyShell>;
}
