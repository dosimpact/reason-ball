import { tradeCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

export const waveThreeCandles = tradeCandles();
export const waveThreeUnit = getUnitSummary("wave-three");
export const waveThreeContent: TutorialContent = {
  summary: waveThreeUnit, candles: waveThreeCandles, initialVisibleCandles: 8,
  hint: "시작 저점, 첫 상승 고점, 조정 저점을 찾으세요. 조정 저점은 시작점 위에 있어야 합니다. 카운팅 무효화와 선택한 Stop Loss를 구분하세요.",
  exampleIndices: [0, 3, 6],
};
