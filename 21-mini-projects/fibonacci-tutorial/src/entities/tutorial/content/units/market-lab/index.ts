import { tradeCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

export const marketLab: TutorialContent = {
  summary: getUnitSummary("market-lab"), candles: tradeCandles(604_800), initialVisibleCandles: 8,
  hint: "계획은 관측 캔들과 판단 시각을 고정합니다. 나중 평가는 그 이후 확정봉만 사용하고 이전 계획·평가를 보존해야 합니다.",
  exampleIndices: [0, 3, 6],
};
