import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadHistoricalFixture } from "./historical";

describe("fixed historical fixtures", () => {
  it("verifies the manifest hash, closed UTC range, and full candle count", async () => {
    const fixture = await loadHistoricalFixture("btc-2024-01");
    expect(fixture.candles).toHaveLength(120);
    expect(fixture.candles[0].time * 1000).toBe(fixture.manifest.startTime);
    expect(fixture.snapshotId).toBe(`sha256:${fixture.manifest.sha256}`);
  });

  it("uses one UTC window for every multiscale resolution", async () => {
    const [hour, fourHour, day] = await Promise.all([
      loadHistoricalFixture("mtf-1h"), loadHistoricalFixture("mtf-4h"), loadHistoricalFixture("mtf-1d"),
    ]);
    expect([hour.candles.length, fourHour.candles.length, day.candles.length]).toEqual([480, 120, 20]);
    expect(new Set([hour.manifest.startTime, fourHour.manifest.startTime, day.manifest.startTime]).size).toBe(1);
    expect(new Set([hour.manifest.endTime, fourHour.manifest.endTime, day.manifest.endTime]).size).toBe(1);
  });
});
