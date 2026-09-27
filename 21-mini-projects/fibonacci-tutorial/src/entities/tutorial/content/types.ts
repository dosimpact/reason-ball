import type { Candle } from "@/entities/candle/@x";
import type { TheoryStep, UnitSummary } from "@/entities/tutorial";

export interface TutorialContent {
  summary: UnitSummary;
  candles: Candle[];
  initialVisibleCandles: number;
  steps?: TheoryStep[];
  hint: string;
  exampleIndices: number[];
}
