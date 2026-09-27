import { describe, expect, it } from "vitest";
import { catalog, catalogSchema, createSessionInputSchema, sessionViewSchema } from "./index";

describe("tutorial public contract", () => {
  it("registers 44 unique units in ten chapters", () => {
    const parsed = catalogSchema.parse(catalog);
    const units = parsed.chapters.flatMap((chapter) => chapter.units);
    expect(parsed.chapters).toHaveLength(10);
    expect(units).toHaveLength(44);
    expect(new Set(units.map((unit) => unit.id)).size).toBe(44);
    expect(units.every((unit) => parsed.chapters.some((chapter) => chapter.id === unit.chapterId))).toBe(true);
    expect(units.every((unit) => !("candles" in unit))).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain("exampleIndices");
  });
  it("defaults omitted source to dummy", () => {
    expect(createSessionInputSchema.parse({ unitId: "wave-three" }).source).toEqual({ type: "dummy" });
  });
  it("hydrates legacy session fields", () => {
    const old = { id: "fc1c3278-85bc-4954-b965-48452e4807b0", unitId: "wave-three", cursor: 0, visibleCandles: [{ time: 0, open: 1, high: 1, low: 1, close: 1 }], totalCandles: 1, plan: null, evaluations: [], complete: false };
    const parsed = sessionViewSchema.parse(old);
    expect(parsed.source).toEqual({ type: "dummy" });
    expect(parsed.plans).toEqual([]);
    expect(parsed.reflection).toBeNull();
  });
});
