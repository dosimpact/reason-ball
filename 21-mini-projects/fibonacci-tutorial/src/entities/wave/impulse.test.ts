import { describe, expect, it } from "vitest";
import { selectImpulsePoints, validateImpulse, type WavePoint } from "./index";
import { fibonacciLevels } from "@/entities/fibonacci/@x";

const times = [0, 1, 2, 3, 4, 5];
function points(prices: number[]): WavePoint[] { return prices.map((price, wave) => ({ wave: wave as WavePoint["wave"], candleIndex: wave, time: times[wave], price })); }
function failed(prices: number[], rule: string): boolean { return validateImpulse(points(prices)).find((item) => item.rule === rule)?.pass === false; }

describe("standard upward impulse", () => {
  it("accepts an advancing six-point count", () => {
    expect(validateImpulse(points([100, 120, 110, 140, 125, 150])).every((item) => item.pass)).toBe(true);
  });
  it("rejects unordered and out-of-range indices", () => {
    const candles = Array.from({ length: 6 }, (_, index) => ({ time: index, open: 100, high: 110, low: 90, close: 100 }));
    expect(() => selectImpulsePoints(candles, [0, 1, 2, 3, 4])).toThrow();
    expect(() => selectImpulsePoints(candles, [0, 1, 2, 3, 4, 4])).toThrow();
    expect(() => selectImpulsePoints(candles, [0, 1, 2, 3, 4, 6])).toThrow();
  });
  it("allows Wave 2 to touch the start but not cross it", () => {
    expect(failed([100, 120, 100, 140, 125, 150], "wave-2")).toBe(false);
    expect(failed([100, 120, 99, 140, 125, 150], "wave-2")).toBe(true);
  });
  it("allows a tied Wave 3 length but rejects a uniquely shortest Wave 3", () => {
    expect(failed([100, 120, 110, 130, 125, 146], "wave-3")).toBe(false);
    expect(failed([100, 120, 110, 129, 125, 146], "wave-3")).toBe(true);
  });
  it("counts Wave 4 touching the Wave 1 high as overlap", () => {
    expect(failed([100, 120, 110, 140, 120, 150], "wave-4")).toBe(true);
    expect(failed([100, 120, 110, 140, 120.01, 150], "wave-4")).toBe(false);
  });
  it("rejects non-advancing five-wave structure", () => {
    expect(failed([100, 120, 110, 119, 115, 130], "structure")).toBe(true);
  });
});

describe("Fibonacci levels", () => {
  it("projects retracements from Wave 1 and extension from Wave 2", () => {
    expect(fibonacciLevels(points([100, 120, 110, 140, 125, 150]))).toEqual({ retracement382: 112.36, retracement50: 110, retracement618: 107.64, extension1618: 142.36 });
  });
  it("requires a rising Wave 1", () => {
    expect(() => fibonacciLevels(points([120, 100, 110]))).toThrow();
  });
});
