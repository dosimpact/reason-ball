import { impulseCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

export const rulesPractice: TutorialContent = {
  summary: getUnitSummary("rules-practice"), candles: impulseCandles(259_200), initialVisibleCandles: 12,
  hint: "Wave 2와 시작 저점, 1·3·5파 길이, Wave 4 저점과 Wave 1 고점을 차례로 비교하세요. 같은 가격은 이론의 경계 정책을 따릅니다.",
  exampleIndices: [0, 2, 4, 6, 8, 10],
};
