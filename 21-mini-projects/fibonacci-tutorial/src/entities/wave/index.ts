import { z } from "zod";
import type { Candle } from "@/entities/candle/@x";

export const wavePointSchema = z.strictObject({
  wave: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  candleIndex: z.number().int().nonnegative(),
  time: z.number().int().nonnegative(),
  price: z.number().finite().positive(),
});
export type WavePoint = z.infer<typeof wavePointSchema>;
export const validationResultSchema = z.strictObject({ rule: z.string().min(1), pass: z.boolean(), reason: z.string().min(1) });
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type ImpulsePoints = [WavePoint, WavePoint, WavePoint, WavePoint, WavePoint, WavePoint];

function selectPoints(candles: readonly Candle[], indices: readonly number[]): WavePoint[] {
  if (indices.some((index, position) => !Number.isInteger(index) || index < 0 || index >= candles.length || (position > 0 && index <= indices[position - 1]))) {
    throw new Error("Wave points must be ordered and within visible candles.");
  }
  return indices.map((index, wave) => ({
    wave: wave as WavePoint["wave"], candleIndex: index, time: candles[index].time,
    price: wave % 2 === 0 ? candles[index].low : candles[index].high,
  }));
}

export function selectWavePoints(candles: readonly Candle[], indices: readonly [number, number, number]): [WavePoint, WavePoint, WavePoint] {
  const points = selectPoints(candles, indices) as [WavePoint, WavePoint, WavePoint];
  if (!(points[0].price < points[2].price && points[2].price < points[1].price)) {
    throw new Error("Wave 2 must retrace Wave 1 without crossing the Wave 0 low.");
  }
  return points;
}

export function selectImpulsePoints(candles: readonly Candle[], indices: readonly number[]): ImpulsePoints {
  if (indices.length !== 6) throw new Error("An impulse requires six points (start and Waves 1–5).");
  return selectPoints(candles, indices) as ImpulsePoints;
}

function result(rule: string, pass: boolean, reason: string): ValidationResult { return { rule, pass, reason }; }

export function validateImpulse(points: readonly WavePoint[]): ValidationResult[] {
  if (points.length !== 6 || points.some((point, index) => point.wave !== index || (index > 0 && (point.candleIndex <= points[index - 1].candleIndex || point.time <= points[index - 1].time)))) {
    return [result("structure", false, "시작점과 1–5파를 시간순으로 선택하세요.")];
  }
  const [zero, one, two, three, four, five] = points;
  const impulseRise = one.price > zero.price && three.price > two.price && five.price > four.price;
  const corrections = two.price < one.price && four.price < three.price;
  const advancingPeaks = three.price > one.price && five.price > three.price;
  return [
    result("structure", impulseRise && corrections && advancingPeaks, "상승 Impulse는 상승 1·3·5파와 조정 2·4파가 번갈아 나타나고 고점이 높아져야 합니다."),
    validateWave2(points), validateWave3(points), validateWave4(points),
  ];
}

/** Equality is a permitted 100% retracement in the six-point educational rule. */
export function validateWave2(points: readonly WavePoint[]): ValidationResult {
  if (points.length < 3) throw new Error("Wave 2 validation requires Waves 0–2.");
  return result("wave-2", points[2].price >= points[0].price, "Wave 2는 Wave 1 시작점 아래로 내려가면 안 됩니다. 같은 가격은 허용합니다.");
}

/** Only a uniquely shortest Wave 3 fails; ties are allowed. */
export function validateWave3(points: readonly WavePoint[]): ValidationResult {
  if (points.length < 6) throw new Error("Wave 3 validation requires Waves 0–5.");
  const length1 = points[1].price - points[0].price;
  const length3 = points[3].price - points[2].price;
  const length5 = points[5].price - points[4].price;
  return result("wave-3", !(length3 < length1 && length3 < length5), "Wave 3은 Wave 1과 5보다 모두 엄격히 짧을 수 없습니다. 길이가 같으면 허용합니다.");
}

/** Touching the Wave 1 high is overlap in this standard impulse exercise. */
export function validateWave4(points: readonly WavePoint[]): ValidationResult {
  if (points.length < 5) throw new Error("Wave 4 validation requires Waves 0–4.");
  return result("wave-4", points[4].price > points[1].price, "일반 Impulse에서 Wave 4는 Wave 1 고점보다 높아야 합니다. 같은 가격에 닿아도 겹침입니다.");
}
