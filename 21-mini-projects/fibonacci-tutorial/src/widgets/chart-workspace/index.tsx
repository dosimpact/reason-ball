"use client";

import { useState } from "react";
import { ArrowLeft, Crosshair, MousePointer2, RotateCcw } from "lucide-react";
import type { MonitoringState } from "@/entities/strategy-monitor";
import type { Candle } from "@/entities/tutorial";
import { Button } from "@/shared/ui/button";
import { CandleChart } from "./candle-chart";
import { chartLevels, type ChartPlan } from "./levels";

const waveNames = ["시작점 · 저점", "1파 · 고점", "2파 · 저점", "3파 · 고점", "4파 · 저점", "5파 · 고점"];
export function ChartWorkspace({ candles, selectedIndices, exampleIndices, showFibonacci = false, plan, monitoring, selectionCount, sourceLabel, title, description, onSelect, onUndo, onReset, disabled }: {
  candles: Candle[]; selectedIndices: number[]; exampleIndices?: number[] | null; showFibonacci?: boolean; plan?: ChartPlan | null; monitoring?: MonitoringState | null; selectionCount: number; sourceLabel: string; title: string; description: string;
  onSelect: (index: number) => void; onUndo: () => void; onReset: () => void; disabled: boolean;
}) {
  const [showCandles, setShowCandles] = useState(true);
  const nextWave = selectedIndices.length;
  const displayLevels = chartLevels(candles, selectedIndices.length >= 3 ? selectedIndices : exampleIndices || [], showFibonacci, plan);
  return <section className="chart-card" aria-labelledby="chart-title">
    <div className="chart-topline"><div><span className="eyebrow">MARKET REPLAY / {selectionCount === 6 ? "IMPULSE" : "TRADE"}</span><h2 id="chart-title">{title}</h2><p>{description}</p></div><div className="market-badge"><span className="live-dot" /> {sourceLabel}</div></div>
    <div className="chart-toolbar"><div className="ticker"><span className="ticker-symbol">◈</span><div><strong>{sourceLabel}</strong><small>{candles.length}개 공개 캔들</small></div></div><div className="chart-timeframe">OHLC <span>캔들 차트</span></div></div>
    <CandleChart candles={candles} selectedIndices={selectedIndices} exampleIndices={exampleIndices} showFibonacci={showFibonacci} plan={plan} monitoring={monitoring} onSelect={onSelect} disabled={disabled || nextWave >= selectionCount} />
    {displayLevels.length > 0 && <div className="chart-level-legend" aria-label="차트 가격 기준">{displayLevels.map((level) => <span key={level.label}><i style={{ background:level.color }} />{level.label} <strong>{level.price.toFixed(2)}</strong></span>)}</div>}
    <div className="chart-instruction"><div className="instruction-icon"><Crosshair size={19} /></div><div><strong>{disabled ? "현재 선택은 잠겨 있습니다" : nextWave < selectionCount ? `${waveNames[nextWave]}을 선택하세요` : `${selectionCount}개 지점을 모두 선택했습니다`}</strong><span>{disabled ? "단계를 진행하거나 계획을 수정하면 새로 선택할 수 있습니다." : nextWave < selectionCount ? "공개된 캔들에서 시간 순서대로 지점을 고르세요." : "선택을 검증하거나 계획을 확정하세요."}</span></div>{!disabled && selectedIndices.length > 0 && <><Button variant="ghost" size="sm" onClick={onUndo}><ArrowLeft size={15} /> Undo</Button><Button variant="ghost" size="sm" onClick={onReset}><RotateCcw size={14} /> Reset</Button></>}</div>
    <div className="candle-picker-head"><div><MousePointer2 size={15} /><strong>캔들 직접 선택</strong><span>키보드 접근 가능</span></div><button type="button" onClick={() => setShowCandles((open) => !open)} aria-expanded={showCandles}>{showCandles ? "접기" : "펼치기"}</button></div>
    {showCandles && <div className="candle-picker" role="group" aria-label="공개된 캔들 선택">{candles.map((candle, index) => {
      const wave = selectedIndices.indexOf(index);
      return <button key={`${candle.time}-${index}`} type="button" className={`candle-option ${wave >= 0 ? "candle-option-selected" : ""}`} onClick={() => onSelect(index)} disabled={disabled || nextWave >= selectionCount || selectedIndices.includes(index) || (nextWave > 0 && index <= selectedIndices[nextWave - 1])} aria-label={`${index + 1}번째 캔들, 최고 ${candle.high}, 최저 ${candle.low}${wave >= 0 ? `, ${wave}파 선택됨` : ""}`}>
        <span>{String(index + 1).padStart(2, "0")}</span><strong>{wave >= 0 ? `W${wave}` : candle.close.toFixed(1)}</strong><small>H {candle.high} · L {candle.low}</small>
      </button>;
    })}</div>}
  </section>;
}

export { CandleChart } from "./candle-chart";
