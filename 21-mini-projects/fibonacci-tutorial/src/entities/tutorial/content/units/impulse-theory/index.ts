import { impulseCandles } from "../../fixture";
import type { TutorialContent } from "../../types";
import { getUnitSummary } from "@/entities/tutorial";

export const impulseTheory: TutorialContent = {
  summary: getUnitSummary("impulse-theory"), candles: impulseCandles(), initialVisibleCandles: 2,
  steps: [
    { title: "상승 Impulse", description: "일반적인 상승 Impulse는 시작 저점부터 5개 파동으로 이어집니다. 1·3·5파는 상승하고 2·4파는 조정합니다. 파동 라벨은 가격 해석이며 예측이 아닙니다.", visibleCount: 2, waveIndices: [0], showFibonacci: false },
    { title: "Wave 1과 Wave 2", description: "Wave 1은 시작점에서 상승하고 Wave 2는 되돌립니다. 깊은 조정도 가능하지만 시작점 아래로 내려가면 이 카운팅은 무효입니다.", visibleCount: 5, waveIndices: [0, 2, 4], showFibonacci: false },
    { title: "Wave 3과 Wave 4", description: "Wave 3은 되돌림 뒤 상승합니다. 일반 Impulse의 Wave 4는 Wave 1 가격 영역과 겹치지 않아야 합니다.", visibleCount: 9, waveIndices: [0, 2, 4, 6, 8], showFibonacci: false },
    { title: "Wave 5와 이후 흐름", description: "Wave 5로 5파 해석이 완성됩니다. 이후 조정이 올 수 있지만 경로와 시점은 불확실합니다. 여기서는 ABC를 카운팅하지 않습니다.", visibleCount: 12, waveIndices: [0, 2, 4, 6, 8, 10], showFibonacci: false },
  ],
  hint: "고점과 저점의 교대를 먼저 살펴본 뒤 5파를 표시하세요.", exampleIndices: [0, 2, 4, 6, 8, 10],
};
