import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Candle } from "@/entities/candle";

const root = new URL("../src/server/candle-data/fixtures/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8")) as { id: string; file: string; count: number; interval: "1h" | "4h" | "1d"; startTime: number; endTime: number; sha256: string }[];
const duration = { "1h": 3600, "4h": 14400, "1d": 86400 };
function data(id: string): Candle[] {
  return JSON.parse(readFileSync(new URL(manifest.find((m) => m.id === id)!.file, root), "utf8"));
}
describe("captured curriculum market data", () => {
  for (const item of manifest) it(`${item.id} preserves its source bytes, range, order and OHLC`, () => {
    const raw = readFileSync(new URL(item.file, root));
    expect(createHash("sha256").update(raw).digest("hex")).toBe(item.sha256);
    const bars: Candle[] = JSON.parse(raw.toString());
    expect(bars).toHaveLength(item.count);
    expect(bars[0].time * 1000).toBe(item.startTime);
    expect((bars.at(-1)!.time + duration[item.interval]) * 1000 - 1).toBe(item.endTime);
    bars.forEach((bar, index) => {
      expect(bar.time).toBe(item.startTime / 1000 + index * duration[item.interval]);
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
      expect(bar.volume).toBeGreaterThanOrEqual(0);
    });
  });
  it("1h, 4h and 1d have the same UTC range and matching OHLC aggregation", () => {
    const hourly = data("mtf-1h");
    for (const [id, size] of [["mtf-4h", 4], ["mtf-1d", 24]] as const) {
      data(id).forEach((bar, index) => {
        const slice = hourly.slice(index * size, (index + 1) * size);
        expect(bar.time).toBe(slice[0].time);
        expect(bar.open).toBe(slice[0].open);
        expect(bar.close).toBe(slice.at(-1)!.close);
        expect(bar.high).toBe(Math.max(...slice.map((v) => v.high)));
        expect(bar.low).toBe(Math.min(...slice.map((v) => v.low)));
        expect(bar.volume).toBeCloseTo(slice.reduce((sum, v) => sum + v.volume!, 0), 5);
      });
    }
  });
});
