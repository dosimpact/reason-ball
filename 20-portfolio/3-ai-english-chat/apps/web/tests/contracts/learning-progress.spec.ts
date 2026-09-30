import { expect, test } from "@playwright/test";
import { demoProgressSource, shiftLearningDate, summarizeLearningProgress, type ActivityDay } from "../../src/entities/learning-session/model/progress";

const day = (date: string, minutes = 0, messages = 0): ActivityDay => ({ date, minutes, messages, missionsStarted: 0, missionsCompleted: 0 });

test("fills seven UTC dates, sums the same chart values and preserves source inputs", () => {
  const input = { today: "2026-01-02", source: "account" as const, expressionCount: 3,
    days: [day("2026-01-01", 15), day("2025-12-31", 4), day("2025-12-25", 50), day("2026-01-03", 100)] };
  const before = structuredClone(input);
  const result = summarizeLearningProgress(input);
  expect(result.recentDays.map((item) => item.date)).toEqual(["2025-12-27", "2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"]);
  expect(result).toMatchObject({ recentMinutes: 19, streak: 2, longestStreak: 2, expressionCount: 3 });
  expect(input).toEqual(before);
});

test("counts meaningful activity but not an empty row and resets a stale streak", () => {
  const days = [day("2026-09-06", 1), day("2026-09-07", 0, 1), { ...day("2026-09-08"), missionsCompleted: 1 }, day("2026-09-09")];
  expect(summarizeLearningProgress({ today: "2026-09-10", source: "account", expressionCount: 0, days })).toMatchObject({ streak: 0, longestStreak: 3, recentMinutes: 1 });
  days.push({ ...day("2026-09-10"), missionsStarted: 1 });
  expect(summarizeLearningProgress({ today: "2026-09-10", source: "account", expressionCount: 0, days })).toMatchObject({ streak: 1, longestStreak: 3 });
});

test("empty history is seven zero days without manufactured progress", () => {
  const result = summarizeLearningProgress({ today: "2024-03-01", source: "account", expressionCount: 0, days: [] });
  expect(result).toMatchObject({ streak: 0, longestStreak: 0, recentMinutes: 0, expressionCount: 0 });
  expect(result.recentDays).toHaveLength(7);
  expect(result.recentDays[5].date).toBe("2024-02-29");
  expect(shiftLearningDate("2025-03-01", -1)).toBe("2025-02-28");
});

test("rejects invalid dates, duplicate rows, fractional minutes and missing counts", () => {
  const input = { today: "2026-09-10", source: "account" as const, expressionCount: 0, days: [] as ActivityDay[] };
  expect(() => shiftLearningDate("2026-02-30", 1)).toThrow();
  expect(() => shiftLearningDate(input.today, 0.5)).toThrow();
  expect(() => summarizeLearningProgress({ ...input, days: [day(input.today), day(input.today)] })).toThrow("Duplicate");
  for (const minutes of [-1, 0.5, NaN]) expect(() => summarizeLearningProgress({ ...input, days: [day(input.today, minutes)] })).toThrow();
  expect(() => summarizeLearningProgress({ ...input, expressionCount: -1 })).toThrow();
});

test("demo data is explicitly labeled and has internally consistent totals", () => {
  expect(summarizeLearningProgress(demoProgressSource("2026-09-10"))).toMatchObject({ source: "demo", recentMinutes: 42, streak: 7, longestStreak: 7, expressionCount: 0 });
});
