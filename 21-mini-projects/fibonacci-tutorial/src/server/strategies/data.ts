import "server-only";
import { createHash } from "node:crypto";
import type { Candle } from "@/entities/candle";
import type { StrategyMode, StrategySource, StrategyView } from "@/entities/strategy";
import { binanceIntervalMs, getBinanceCandles, MarketDataError } from "@/server/candle-data/binance";
import { waveThreeCandles } from "@/server/candle-data/wave-three";

export interface StrategySnapshot {
  id: string;
  candles: Candle[];
  initialCursor: number;
  source: StrategySource;
  dataset: StrategyView["dataset"];
}

/** Selection metadata only. Never expose candles after a draft's asOf. */
export function listDummyCutoffs(): { dummyCutoffs: Array<{ index: number; ordinal: number; asOf: number; maxBacktestBars: number }> } {
  return {
    dummyCutoffs: waveThreeCandles.slice(4, -1).map((candle, offset) => ({
      index: offset + 4, ordinal: offset + 5, asOf: candle.time, maxBacktestBars: waveThreeCandles.length - offset - 5,
    })),
  };
}

export function snapshotDigest(source: StrategySource, candles: readonly Candle[]): string {
  return `sha256:${createHash("sha256").update(JSON.stringify({ source, candles })).digest("hex")}`;
}

function ensureContinuous(candles: readonly Candle[], intervalSeconds: number): void {
  for (let index = 1; index < candles.length; index += 1) {
    if (candles[index].time - candles[index - 1].time !== intervalSeconds) {
      throw new MarketDataError(502, "Market data has a duplicate or missing closed candle.");
    }
  }
}

function dataset(source: StrategySource, mode: StrategyMode, candles: readonly Candle[]): StrategySnapshot["dataset"] {
  return {
    label: source.type === "dummy" ? "더미 순차 시뮬레이션" : `${source.symbol} · ${source.interval} · Binance`,
    kind: source.type === "dummy" ? "dummy-simulation" : mode === "BACKTEST" ? "binance-historical" : "binance-live",
    symbol: source.type === "binance" ? source.symbol : null,
    interval: source.type === "binance" ? source.interval : "1h",
    rangeStart: candles[0].time, rangeEnd: candles.at(-1)!.time, availableCount: candles.length,
  };
}

function dummySnapshot(source: StrategySource, mode: StrategyMode, asOf?: number, backtestBars = 4): StrategySnapshot {
  const all = waveThreeCandles.map((candle) => ({ ...candle }));
  const initialCursor = asOf === undefined ? 7 : all.findIndex((candle) => candle.time === asOf);
  if (initialCursor < 2 || initialCursor >= all.length) throw new Error("Choose a dummy asOf candle with at least three visible bars.");
  if (mode === "BACKTEST" && initialCursor + 1 + backtestBars > all.length) throw new Error("The dummy backtest horizon exceeds available candles.");
  const candles = mode === "BACKTEST" ? all.slice(0, initialCursor + 1 + backtestBars) : all;
  return { id: snapshotDigest(source, candles), candles, initialCursor, source, dataset: dataset(source, mode, candles) };
}

async function fetchHistorical(source: Extract<StrategySource, {type:"binance"}>, asOf: number, backtestBars: number): Promise<Candle[]> {
  const duration = binanceIntervalMs(source.interval);
  const latestClosedOpen = Math.floor(Date.now() / duration) * duration - duration;
  if (asOf * 1000 + backtestBars * duration > latestClosedOpen) throw new Error("The selected backtest horizon extends beyond the latest closed Binance candle.");
  const startMs = Math.max(0, asOf * 1000 - 79 * duration);
  const past = await getBinanceCandles(source, { startTime: startMs, endTime: asOf * 1000 + duration - 1, limit: 80 });
  if (past.length < 3 || past.at(-1)?.time !== asOf) throw new Error("The selected asOf is not an available closed Binance candle.");
  ensureContinuous(past, duration / 1000);
  const future: Candle[] = [];
  let nextOpen = asOf * 1000 + duration;
  const lastRequested = nextOpen + (backtestBars - 1) * duration;
  for (let remaining = backtestBars; remaining > 0; ) {
    const count = Math.min(1000, remaining);
    const page = await getBinanceCandles(source, { startTime: nextOpen, endTime: Math.min(lastRequested, nextOpen + (count - 1) * duration) + duration - 1, limit: count });
    if (page.length !== count) throw new MarketDataError(502, "Historical Binance data is missing a requested closed candle.");
    if (page[0].time * 1000 !== nextOpen) throw new MarketDataError(502, "Market data has a gap after the asOf candle.");
    ensureContinuous(page, duration / 1000);
    future.push(...page);
    remaining -= page.length;
    nextOpen = page.at(-1)!.time * 1000 + duration;
  }
  ensureContinuous([...past.slice(-1), ...future], duration / 1000);
  return [...past, ...future];
}

export async function createStrategySnapshot(source: StrategySource, mode: StrategyMode, asOf?: number, backtestBars = 120): Promise<StrategySnapshot> {
  if (source.type === "dummy") return dummySnapshot(source, mode, asOf, backtestBars);
  const duration = binanceIntervalMs(source.interval);
  let candles: Candle[];
  if (mode === "FORWARD") {
    candles = await getBinanceCandles(source, { limit: 120 });
    if (candles.length < 3) throw new Error("At least three closed Binance candles are required.");
    ensureContinuous(candles, duration / 1000);
    if (asOf !== undefined && asOf !== candles.at(-1)!.time) throw new Error("Forward asOf must be the latest closed Binance candle.");
  } else {
    if (asOf === undefined) throw new Error("Historical Binance backtests require an explicit asOf candle.");
    candles = await fetchHistorical(source, asOf, backtestBars);
  }
  const initialCursor = mode === "FORWARD" ? candles.length - 1 : candles.findIndex((candle) => candle.time === asOf);
  return { id: snapshotDigest(source, candles), candles, initialCursor, source, dataset: dataset(source, mode, candles) };
}

export async function getForwardBinanceBars(source: Extract<StrategySource, {type:"binance"}>, afterSeconds: number): Promise<Candle[]> {
  const duration = binanceIntervalMs(source.interval);
  const end = Math.floor(Date.now() / duration) * duration - 1;
  let nextOpen = afterSeconds * 1000 + duration;
  if (nextOpen > end) return [];
  const count = Math.floor((end - nextOpen) / duration) + 1;
  if (count > 4000) throw new MarketDataError(503, "Forward gap exceeds the 4000-candle evaluation limit.");
  const collected: Candle[] = [];
  while (nextOpen <= end) {
    const limit = Math.min(1000, Math.floor((end - nextOpen) / duration) + 1);
    const page = await getBinanceCandles(source, { startTime: nextOpen, endTime: Math.min(end, nextOpen + (limit - 1) * duration + duration - 1), limit });
    if (page.length === 0 || page[0].time * 1000 !== nextOpen) throw new MarketDataError(502, "Forward market data has a missing closed candle.");
    ensureContinuous(page, duration / 1000);
    collected.push(...page);
    nextOpen = page.at(-1)!.time * 1000 + duration;
    if (page.length < limit && nextOpen <= end) throw new MarketDataError(502, "Forward market data ended before the latest closed candle.");
  }
  return collected;
}
