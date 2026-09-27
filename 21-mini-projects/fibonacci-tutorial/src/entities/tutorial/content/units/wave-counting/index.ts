import { impulseCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

export const waveCounting: TutorialContent = {
  summary: getUnitSummary("wave-counting"), candles: impulseCandles(86_400), initialVisibleCandles: 12,
  hint: "첫 저점에서 시작해 시간순으로 고점·저점·고점·저점·고점을 선택하세요. 캔들 색보다 가격 관계를 확인하세요.",
  exampleIndices: [0, 2, 4, 6, 8, 10],
};
