import { tradeCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

const initialCandles = tradeCandles(518_400);
const lastTime = initialCandles[initialCandles.length - 1].time;
const reviewRows = [
  [143, 146, 139, 141], [141, 142, 135, 136], [136, 137, 130, 132],
  [132, 145, 131, 143], [143, 153, 142, 151], [151, 160, 150, 158],
  [158, 159, 142, 145], [145, 146, 127, 130],
];

export const tradeReviewFullImpulseIndices = [0, 3, 6, 11, 14, 17] as const;
export const tradeReviewCandles = [
  ...initialCandles,
  ...reviewRows.map(([open, high, low, close], index) => ({
    time: lastTime + (index + 1) * 3600, open, high, low, close,
  })),
];

export const tradeReview: TutorialContent = {
  summary: getUnitSummary("trade-review"), candles: tradeReviewCandles, initialVisibleCandles: 8,
  hint: "미래 캔들을 보기 전에 진입·손절·목표·청산 이유를 확정하세요. Replay가 5파와 이후 조정을 보여주면 실현 R과 조정 위험을 근거로 close 또는 hold 판단을 회고하세요. 자동 익절로 단정하지 마세요.",
  exampleIndices: [...tradeReviewFullImpulseIndices],
};
