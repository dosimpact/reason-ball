import { describe, expect, it } from "vitest";
import type { Candle } from "@/entities/candle/@x";
import { calculateFibonacci } from "@/entities/fibonacci/@x";
import { selectWavePoints } from "@/entities/wave";

const candles: Candle[] = [
  { time: 1, open: 102, high: 105, low: 100, close: 103 },
  { time: 2, open: 116, high: 120, low: 115, close: 118 },
  { time: 3, open: 112, high: 114, low: 110, close: 111 },
];

describe("wave selection and Fibonacci calculation", () => {
  it("uses Wave 0/2 lows and Wave 1 high", () => {
    const points = selectWavePoints(candles, [0, 1, 2]);
    expect(points.map((point) => point.price)).toEqual([100, 120, 110]);
    expect(calculateFibonacci(points)).toEqual({ retracement: 0.5, extension1618: 142.36 });
  });

  it("rejects future, unordered, and invalid retracement points", () => {
    expect(() => selectWavePoints(candles, [0, 1, 3])).toThrow();
    expect(() => selectWavePoints(candles, [1, 0, 2])).toThrow();
    expect(() => selectWavePoints([{ ...candles[0], low: 112 }, candles[1], candles[2]], [0, 1, 2])).toThrow();
  });
});
