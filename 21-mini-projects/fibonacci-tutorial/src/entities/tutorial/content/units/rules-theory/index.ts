import { impulseCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

export const rulesTheory: TutorialContent = {
  summary: getUnitSummary("rules-theory"), candles: impulseCandles(172_800), initialVisibleCandles: 5,
  steps: [
    { title: "규칙 1: Wave 2", description: "Wave 2는 Wave 1 시작점 아래로 내려갈 수 없습니다. 이 튜토리얼에서는 정확히 같은 가격까지 허용하고 더 낮으면 실패합니다.", visibleCount: 5, waveIndices: [0, 2, 4], showFibonacci: false },
    { title: "규칙 2: Wave 3", description: "상승하는 1·3·5파 중 Wave 3은 엄격히 가장 짧을 수 없습니다. 길이가 같으면 허용합니다. 기간이 아니라 가격 길이를 비교하세요.", visibleCount: 11, waveIndices: [0, 2, 4, 6, 8, 10], showFibonacci: false },
    { title: "규칙 3: Wave 4", description: "일반 Impulse에서 Wave 4는 Wave 1 가격 영역과 겹칠 수 없습니다. 이 튜토리얼에서는 Wave 1 고가에 닿아도 겹침입니다.", visibleCount: 12, waveIndices: [0, 2, 4, 6, 8, 10], showFibonacci: false },
    { title: "가이드라인은 선택 사항", description: "Wave 1과 5의 균등, 조정파의 교대는 해석을 돕는 가이드라인입니다. 카운팅 비교에는 활용하지만 여기서 무효 판정에는 사용하지 않습니다.", visibleCount: 12, waveIndices: [0, 2, 4, 6, 8, 10], showFibonacci: false },
  ],
  hint: "비율·교대 가이드라인보다 먼저 3대 규칙을 확인하세요.", exampleIndices: [0, 2, 4, 6, 8, 10],
};
