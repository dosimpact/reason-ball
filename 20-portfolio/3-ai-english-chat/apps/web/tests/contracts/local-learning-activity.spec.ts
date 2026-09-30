import { expect, test } from "@playwright/test";
import { applyLocalActivity, initialLocalActivity, type LocalActivity, type LocalActivityRequest } from "../../src/entities/learning-session/model/local-activity";
import { createLocalActivityRepository, localActivityKey } from "../../src/entities/learning-session/api/local-activity-repository";
import { summarizeLearningProgress } from "../../src/entities/learning-session/model/progress";

const request = (index: number, active = true): LocalActivityRequest => ({ conversationId: "local-chat", requestId: `59000000-0000-4000-8000-${String(index).padStart(12, "0")}`, active });
const start = Date.parse("2026-12-31T23:59:50.250Z");

test("local intervals split UTC midnight without modifying inputs and replay the original receipt", () => {
  const initial = { ...initialLocalActivity(start), days: [] };
  const first = applyLocalActivity(initial, request(1), start);
  const before = structuredClone(first.state);
  const next = applyLocalActivity(first.state, request(2), start + 20_000);
  expect(first.state).toEqual(before);
  expect(next.result.acceptedSeconds).toBe(20);
  expect(next.state.days.map(({ date, activeSeconds }) => ({ date, activeSeconds }))).toEqual([
    { date: "2026-12-31", activeSeconds: 10 }, { date: "2027-01-01", activeSeconds: 10 },
  ]);
  const replay = applyLocalActivity(next.state, request(2), start + 40_000);
  expect(replay).toEqual(next);
  expect(() => applyLocalActivity(next.state, request(2, false), start + 40_000)).toThrow("reused");
});

test("local activity excludes paused, disconnected and backwards intervals", () => {
  const initial = initialLocalActivity(start);
  expect(applyLocalActivity(initial, request(1), start).result.acceptedSeconds).toBe(0);
  const started = applyLocalActivity(initial, request(1), start).state;
  expect(applyLocalActivity(started, request(2), start + 45_001).result.acceptedSeconds).toBe(0);
  expect(applyLocalActivity(started, request(2), start - 1).result.acceptedSeconds).toBe(0);
  const stopped = applyLocalActivity(started, request(2, false), start + 15_000);
  expect(stopped.result.acceptedSeconds).toBe(15);
  expect(applyLocalActivity(stopped.state, request(3), start + 30_000).result.acceptedSeconds).toBe(0);
  expect(() => initialLocalActivity(NaN)).toThrow();
  expect(() => applyLocalActivity(started, request(2), -1)).toThrow();
});

test("consecutive subsecond endpoints retain seconds and minutes remain consistent", () => {
  let state: LocalActivity = { ...initialLocalActivity(start), days: [] };
  for (let index = 0; index <= 5; index++) state = applyLocalActivity(state, request(index + 1), start + index * 15_000).state;
  expect(state.days.reduce((sum, day) => sum + (day.activeSeconds ?? 0), 0)).toBe(75);
  expect(state.days.every((day) => day.minutes === Math.floor((day.activeSeconds ?? 0) / 60))).toBe(true);
});

test("persisted demo dates do not move on reload and storage errors leave existing data untouched", () => {
  const data = new Map<string, string>([["unrelated", "keep"]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const repository = createLocalActivityRepository(storage);
  const first = repository.read(start);
  expect(repository.read(start + 10 * 86_400_000)).toEqual(first);
  expect(summarizeLearningProgress({ source: "demo", today: "2027-01-10", days: first.days, expressionCount: 0 })).toMatchObject({ streak: 0, recentMinutes: 0 });
  const serialized = data.get(localActivityKey);
  const failing = createLocalActivityRepository({ ...storage, setItem: () => { throw new Error("quota"); } });
  expect(() => failing.record(request(1), start)).toThrow("quota");
  expect(data.get(localActivityKey)).toBe(serialized);
  expect(data.get("unrelated")).toBe("keep");
  data.set(localActivityKey, "corrupt");
  expect(() => repository.read(start)).toThrow();
  expect(data.get(localActivityKey)).toBe("corrupt");
});
