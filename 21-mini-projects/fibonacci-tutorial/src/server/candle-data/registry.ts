import "server-only";
import { createHash } from "node:crypto";
import type { Candle } from "@/entities/candle";
import { getTutorialContent } from "@/entities/tutorial/content/server";
import type { SourceConfig } from "@/entities/tutorial";
import { binanceIntervalMs, getBinanceCandles } from "./binance";
import { getLessonCase, getLessonDefinition } from "@/entities/lesson/server";
import { loadHistoricalFixture } from "./historical";

export interface ScenarioSnapshot {
  source: "dummy" | "binance";
  sourceConfig?: SourceConfig;
  id: string;
  candles: Candle[];
  timeframes?: { "1h": Candle[]; "4h": Candle[]; "1d": Candle[] };
}

const historicalIds = ["btc-2024-01", "eth-2024-02", "btc-2024-03"] as const;

export async function createLessonSnapshot(unitId: string, caseIndex: number, source: SourceConfig): Promise<{ snapshot: ScenarioSnapshot; initialCursor: number }> {
  const definition = getLessonDefinition(unitId);
  if (!definition) throw new Error("Unknown advanced lesson.");
  const lessonCase = definition.kind === "theory" ? undefined : getLessonCase(unitId, caseIndex);
  if (definition.kind === "practice" && !lessonCase) throw new Error("Unknown lesson case.");
  let candles: Candle[];
  let timeframes: ScenarioSnapshot["timeframes"];
  let resolvedSource: SourceConfig = source;
  if (definition.kind === "theory") {
    candles = definition.candles?.map((bar) => ({ ...bar })) ?? [];
  } else if (lessonCase?.source === "authored-dummy") {
    candles = lessonCase.candles?.map((bar) => ({ ...bar })) ?? [];
  } else if (lessonCase?.profile === "M") {
    const [hour, fourHour, day] = await Promise.all([loadHistoricalFixture("mtf-1h"), loadHistoricalFixture("mtf-4h"), loadHistoricalFixture("mtf-1d")]);
    candles = hour.candles;
    timeframes = { "1h": hour.candles, "4h": fourHour.candles, "1d": day.candles };
    resolvedSource = { type: "binance", symbol: "BTCUSDT", interval: "1h", startTime: hour.manifest.startTime };
  } else if (lessonCase?.source === "binance-historical") {
    const fixture = await loadHistoricalFixture(historicalIds[caseIndex % historicalIds.length]);
    candles = fixture.candles;
    resolvedSource = { type: "binance", symbol: fixture.manifest.symbol, interval: fixture.manifest.interval, startTime: fixture.manifest.startTime };
  } else if (lessonCase?.source === "binance-recent") {
    const recentSource = source.type === "binance" ? source : { type: "binance" as const, symbol: "BTCUSDT" as const, interval: "1h" as const };
    candles = await getBinanceCandles(recentSource, { limit: 120 });
    resolvedSource = recentSource;
  } else {
    throw new Error("Lesson has no data source.");
  }
  if (!candles.length) throw new Error("Lesson has no candles.");
  const initialVisibleCount = definition.kind === "theory" ? definition.steps?.[0]?.visibleCount ?? 12 : lessonCase?.visibleCount ?? candles.length;
  const initialCursor = Math.min(initialVisibleCount, candles.length) - 1;
  const snapshotId = `sha256:${createHash("sha256").update(JSON.stringify({ source: resolvedSource, candles, timeframes })).digest("hex")}`;
  return { snapshot: { source: resolvedSource.type, sourceConfig: resolvedSource, id: snapshotId, candles, timeframes }, initialCursor };
}

export async function createScenarioSnapshot(unitId: string, source: SourceConfig): Promise<{ snapshot: ScenarioSnapshot; initialCursor: number }> {
  const content = getTutorialContent(unitId);
  if (!content) throw new Error("Unknown tutorial unit.");
  const candles = source.type === "binance"
    ? await getBinanceCandles(source, { limit: 120, endTime: source.startTime === undefined ? undefined : source.startTime + 120 * binanceIntervalMs(source.interval) - 1 })
    : content.candles.map((candle) => ({ ...candle }));
  if (candles.length === 0) throw new Error("No closed candles are available for this scenario.");
  const initialCursor = source.type === "binance"
    ? Math.min(79, candles.length - 1)
    : Math.min(content.initialVisibleCandles - 1, candles.length - 1);
  const frozen = candles.map((candle) => ({ ...candle }));
  const digest = createHash("sha256").update(JSON.stringify({ source, candles: frozen })).digest("hex");
  return { snapshot: { source: source.type, sourceConfig: source, id: `sha256:${digest}`, candles: frozen }, initialCursor };
}
