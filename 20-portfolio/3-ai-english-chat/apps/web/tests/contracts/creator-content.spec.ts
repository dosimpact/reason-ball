import { expect, test } from "@playwright/test";
import { migrateMockOwnership } from "../../src/shared/api/learning/mock-ownership";
import { canEditCreation, creationsSchema, creationStatusSchema, type Creation } from "../../src/entities/creator-content/model/creations";

test("legacy ownership uses browser provenance, never display name or learner count", () => {
  const input = { characters: [{ id: "seed", creator: "나" }, { id: "local", creator: "Renamed" }], missions: [{ id: "seed", learnerCount: 0 }, { id: "local", learnerCount: 20 }], xp: 1400, histories: ["keep"] };
  const before = structuredClone(input);
  const result = migrateMockOwnership(input, ["seed"], ["seed"]);
  expect(result.ownedCharacterIds).toEqual(["local"]);
  expect(result.ownedMissionIds).toEqual(["local"]);
  expect(result).toMatchObject({ xp: 1400, histories: ["keep"] });
  expect(input).toEqual(before);
});

test("legacy migration preserves partial state and rejects malformed records", () => {
  const result = migrateMockOwnership({ missions: [{ id: "local" }, { id: "local" }] }, [], []);
  expect(result.ownedMissionIds).toEqual(["local"]);
  expect(result).not.toHaveProperty("characters");
  expect(result.ownedCharacterIds).toEqual([]);
  expect(() => migrateMockOwnership({ characters: [{ name: "missing id" }] }, [], [])).toThrow();
  expect(() => migrateMockOwnership({ missions: "corrupt" }, [], [])).toThrow();
  expect(() => migrateMockOwnership(null, [], [])).toThrow();
});

test("owned summaries retain all lifecycle states and distinguish content kinds", () => {
  const item: Creation = { kind: "character", id: "id", title: "Title", summary: "", status: "draft" };
  for (const status of creationStatusSchema.options) {
    expect(canEditCreation({ ...item, status })).toBe(status === "draft" || status === "published");
    expect(creationsSchema.parse({ source: "account", items: [{ ...item, status }] }).items[0].status).toBe(status);
  }
  expect(creationsSchema.safeParse({ source: "browser", items: [item, { ...item, kind: "mission" }] }).success).toBe(true);
  expect(creationsSchema.safeParse({ source: "account", items: [item, item] }).success).toBe(false);
  expect(creationsSchema.safeParse({ source: "account", items: [{ ...item, status: "unknown" }] }).success).toBe(false);
});
