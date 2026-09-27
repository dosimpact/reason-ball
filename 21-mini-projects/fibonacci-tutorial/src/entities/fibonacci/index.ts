import { z } from "zod";
import type { WavePoint } from "@/entities/wave/@x";

export const fibonacciSchema = z.strictObject({
  retracement: z.number().finite().nonnegative(),
  extension1618: z.number().finite().positive(),
});
export type FibonacciLevels = z.infer<typeof fibonacciSchema>;
export const fibonacciLevelSetSchema = z.strictObject({
  retracement382: z.number().finite().positive(),
  retracement50: z.number().finite().positive(),
  retracement618: z.number().finite().positive(),
  extension1618: z.number().finite().positive(),
});
export type FibonacciLevelSet = z.infer<typeof fibonacciLevelSetSchema>;

export function calculateFibonacci(points: readonly [WavePoint, WavePoint, WavePoint]): FibonacciLevels {
  const impulse = points[1].price - points[0].price;
  if (impulse <= 0) throw new Error("Wave 1 must rise from Wave 0.");
  return {
    retracement: roundPrice((points[1].price - points[2].price) / impulse),
    extension1618: roundPrice(points[2].price + impulse * 1.618),
  };
}

export function fibonacciLevels(points: readonly WavePoint[]): FibonacciLevelSet {
  if (points.length < 3) throw new Error("Fibonacci levels require Waves 0–2.");
  const length = points[1].price - points[0].price;
  if (length <= 0) throw new Error("Wave 1 must rise from Wave 0.");
  return {
    retracement382: roundPrice(points[1].price - length * 0.382),
    retracement50: roundPrice(points[1].price - length * 0.5),
    retracement618: roundPrice(points[1].price - length * 0.618),
    extension1618: roundPrice(points[2].price + length * 1.618),
  };
}
function roundPrice(value: number): number { return Math.round((value + Number.EPSILON) * 1000000) / 1000000; }
