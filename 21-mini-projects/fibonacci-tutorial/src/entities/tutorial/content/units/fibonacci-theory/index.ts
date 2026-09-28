import { tradeCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

export const fibonacciTheory: TutorialContent = {
  summary: getUnitSummary("fibonacci-theory"), candles: tradeCandles(345_600), initialVisibleCandles: 4,
  steps: [
    { title: "Wave 1 기준점", description: "Wave 1의 시작 저점부터 끝 고점까지 측정합니다. 이 차트의 100→120은 20만큼 상승한 구간입니다.", visibleCount: 4, waveIndices: [0, 3], showFibonacci: false },
    { title: "되돌림 후보", description: "Wave 1 고점에서 길이의 38.2%·50%·61.8%를 빼면 후보 가격은 112.36·110·107.64입니다. 확인할 구간이지 보장된 반전 지점은 아닙니다.", visibleCount: 7, waveIndices: [0, 3, 6], showFibonacci: true },
    { title: "1.618 확장", description: "Wave 2 저점에서 Wave 1 길이의 1.618배를 투영합니다. 저점 110이면 142.36입니다. 확정 목표로 여기지 말고 구조·위험과 함께 비교하세요.", visibleCount: 12, waveIndices: [0, 3, 6], showFibonacci: true },
  ],
  hint: "모든 되돌림은 Wave 1의 가격 길이로 구하고, 확장은 Wave 2에서 투영하세요.", exampleIndices: [0, 3, 6],
};
