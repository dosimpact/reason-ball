import { tradeCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

export const fibonacciPractice: TutorialContent = {
  summary: getUnitSummary("fibonacci-practice"), candles: tradeCandles(432_000), initialVisibleCandles: 8,
  hint: "시작 저점, Wave 1 고점, Wave 2 저점을 선택하세요. Wave 1 기준으로 38.2%·50%·61.8%를 구하고 Wave 2에서 1.618을 투영하세요.",
  exampleIndices: [0, 3, 6],
};
