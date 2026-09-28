import type { Candle } from "@/entities/candle";
import { selectImpulsePoints, validateImpulse } from "@/entities/wave";
import { Card } from "@/shared/ui/card";

export function WaveValidationPreview({ candles, indices }: { candles: Candle[]; indices: number[] }) {
  if (indices.length !== 6) return null;
  const results = validateImpulse(selectImpulsePoints(candles, indices));
  return <Card className="lesson-feedback" aria-label="선택 즉시 규칙 검증" aria-live="polite">
    <h2>선택 즉시 규칙 검증</h2>
    <p>공개된 캔들로 자동 계산했습니다. Check Answer로 결과를 저장하세요.</p>
    {results.map((item) => <p key={item.rule} data-rule={item.rule} data-pass={item.pass}>
      <strong>{item.pass ? "통과" : "실패"} · {item.rule}</strong> {item.reason}
    </p>)}
  </Card>;
}
