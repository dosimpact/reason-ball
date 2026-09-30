import { expect, test } from "@playwright/test";
import { localSavedMissionsSchema, savedMissionListSchema, setSavedMission, type LocalSavedMissions } from "../../src/entities/mission/model/saved-missions";
import { createLocalSavedMissions, savedMissionsStorageKey } from "../../src/entities/mission/api/local-saved-missions";

const empty: LocalSavedMissions = { version: 1, entries: [], receipts: [] };
const time = "2026-09-10T12:00:00.000Z";
const request = (n: number, saved = true, missionId = "hotel-check-in") => ({ requestId: `64000000-0000-4000-8000-${String(n).padStart(12, "0")}`, missionId, saved });

test("explicit mission save is pure and replays do not undo a later removal", () => {
  const first = setSavedMission(empty, request(1), time);
  expect(empty.entries).toEqual([]);
  expect(first.state.entries).toEqual([{ missionId: "hotel-check-in", savedAt: time }]);
  const again = setSavedMission(first.state, request(2), "2026-09-11T12:00:00.000Z");
  expect(again.state.entries).toEqual(first.state.entries);
  const removed = setSavedMission(again.state, request(3, false), time);
  expect(removed.state.entries).toEqual([]);
  const replay = setSavedMission(removed.state, request(1), time);
  expect(replay.replayed).toBe(true);
  expect(replay.result.saved).toBe(true);
  expect(replay.state.entries).toEqual([]);
  expect(() => setSavedMission(first.state, request(1, false), time)).toThrow("같은 요청 키");
  expect(() => setSavedMission(first.state, request(1, true, "coffee-order"), time)).toThrow();
});

test("missing mission removal is safe and invalid or corrupt state is rejected", () => {
  expect(setSavedMission(empty, request(1, false), time).state.entries).toEqual([]);
  expect(() => setSavedMission(empty, request(1), "bad")).toThrow();
  expect(() => setSavedMission(empty, { ...request(1), requestId: "bad" }, time)).toThrow();
  const first = setSavedMission(empty, request(1), time).state;
  expect(localSavedMissionsSchema.safeParse({ ...first, entries: [...first.entries, ...first.entries] }).success).toBe(false);
  expect(localSavedMissionsSchema.safeParse({ ...first, receipts: [...first.receipts, ...first.receipts] }).success).toBe(false);
  expect(savedMissionListSchema.safeParse([{ missionId: "hotel", savedAt: time, mission: null }]).success).toBe(true);
  expect(savedMissionListSchema.safeParse([{ missionId: "hotel", savedAt: time, mission: { id: "other", title: "Hidden", summary: "" } }]).success).toBe(false);
});

test("local saved missions persist without touching history and preserve state on quota or parse errors", () => {
  const data = new Map<string, string>([["history", "keep"]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const repository = createLocalSavedMissions(storage);
  expect(repository.read()).toEqual(empty);
  expect(data.has(savedMissionsStorageKey)).toBe(false);
  repository.set(request(1), time);
  expect(createLocalSavedMissions(storage).read().entries).toHaveLength(1);
  const before = data.get(savedMissionsStorageKey);
  const failing = createLocalSavedMissions({ ...storage, setItem: () => { throw new Error("quota"); } });
  expect(() => failing.set(request(2, false), time)).toThrow("quota");
  expect(data.get(savedMissionsStorageKey)).toBe(before);
  expect(failing.set(request(1), time).saved).toBe(true);
  data.set(savedMissionsStorageKey, "corrupt");
  expect(() => repository.set(request(3), time)).toThrow();
  expect(data.get(savedMissionsStorageKey)).toBe("corrupt");
  expect(data.get("history")).toBe("keep");
});
