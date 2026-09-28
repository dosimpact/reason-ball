import type { Candle, TradePlan, WavePoint } from "@/entities/tutorial";
import { fibonacciLevels } from "@/entities/fibonacci";

export type ChartPlan = Pick<TradePlan, "entry" | "stopLoss" | "target" | "invalidationPrice" | "monitoringConfig">;
export type ChartLevel = { label: string; price: number; color: string; lineStyle?: "dotted" | "dashed"; lineWidth?: 1 | 2 };
export function selectedPoint(candles: Candle[], index: number, wave: number): WavePoint | null {
  const candle = candles[index];
  return candle ? { candleIndex: index, wave: wave as WavePoint["wave"], time: candle.time, price: wave % 2 === 0 ? candle.low : candle.high } : null;
}
export function chartLevels(candles: Candle[], indices: number[], showFibonacci: boolean, plan?: ChartPlan | null): ChartLevel[] {
  const points = indices.slice(0, 3).map((index, wave) => selectedPoint(candles, index, wave)).filter((item): item is WavePoint => item !== null);
  const fib = showFibonacci && points.length === 3 && points[1].price > points[0].price ? fibonacciLevels(points) : null;
  return [
    ...(fib ? [
      { label: "38.2% 후보", price: fib.retracement382, color: "var(--fgColor-accent)" },
      { label: "50% 후보", price: fib.retracement50, color: "var(--fgColor-accent)" },
      { label: "61.8% 후보", price: fib.retracement618, color: "var(--fgColor-accent)" },
      { label: "1.618× 후보", price: fib.extension1618, color: "var(--fgColor-attention)" },
    ] : []),
    ...(plan ? [
      { label: "진입", price: plan.entry, color: "var(--fgColor-success)" },
      { label: "손절", price: plan.stopLoss, color: "var(--fgColor-danger)" },
      { label: "목표", price: plan.target, color: "var(--fgColor-attention)" },
      ...((plan.monitoringConfig?.rule.level ?? plan.invalidationPrice) ? [{ label: plan.monitoringConfig?.rule.kind === "wave4-overlap" ? "4파 겹침 무효화" : "카운팅 무효화", price: (plan.monitoringConfig?.rule.level ?? plan.invalidationPrice)!, color: "var(--fgColor-done)", lineStyle: "dotted" as const, lineWidth: 2 as const }] : []),
    ] : []),
  ];
}
