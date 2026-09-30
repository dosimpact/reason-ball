import { expect, test } from "@playwright/test";
import { restoreCharacterDisplayMetadata, restoreMissionDisplayMetadata } from "../../src/shared/api/supabase/version-display-metadata";

const character = { name: "Current", tagline: "Today", description: "Current description" };
const mission = { title: "Current lesson", summary: "Today", scenario_category: "travel", difficulty: "B2", estimated_minutes: 30 };

test("character display uses the published snapshot without mutating inputs", () => {
  const stored = { schemaVersion: 1, name: "Original", tagline: "Before", description: "Original description", tags: ["A1"] };
  const before = structuredClone(stored);
  const restored = restoreCharacterDisplayMetadata(character, ["B2"], stored);
  expect(restored).toEqual({ name: "Original", tagline: "Before", description: "Original description", tags: ["A1"], metadataSource: "published-version" });
  restored.tags.push("changed");
  expect(stored).toEqual(before);
  expect(character.name).toBe("Current");
});

test("mission display preserves the published title, level and duration", () => {
  const stored = { ...mission, schemaVersion: 1, title: "Original lesson", difficulty: "A1", estimated_minutes: 5 };
  const before = structuredClone(stored);
  expect(restoreMissionDisplayMetadata(mission, stored)).toEqual({ ...mission, title: "Original lesson", difficulty: "A1", estimated_minutes: 5, metadataSource: "published-version" });
  expect(stored).toEqual(before);
  expect(mission.difficulty).toBe("B2");
});

test("legacy absent snapshots explicitly identify current-resource fallback", () => {
  for (const absent of [null, undefined]) {
    const tags = ["B2"];
    const restored = restoreCharacterDisplayMetadata(character, tags, absent);
    expect(restored).toEqual({ ...character, tags, metadataSource: "current-resource" });
    restored.tags.push("new");
    expect(tags).toEqual(["B2"]);
    expect(restoreMissionDisplayMetadata(mission, absent)).toEqual({ ...mission, metadataSource: "current-resource" });
  }
});

test("malformed snapshots fail rather than silently replacing history", () => {
  for (const stored of [{}, [], "bad", { ...character, tags: [], schemaVersion: 2 }, { ...character, tags: [], schemaVersion: 1, systemPrompt: "private" }]) {
    expect(() => restoreCharacterDisplayMetadata(character, [], stored)).toThrow();
  }
  for (const stored of [{}, [], { ...mission, schemaVersion: 2 }, { ...mission, schemaVersion: 1, difficulty: "unknown" }, { ...mission, schemaVersion: 1, estimated_minutes: 0 }, { ...mission, schemaVersion: 1, evaluatorPrompt: "private" }]) {
    expect(() => restoreMissionDisplayMetadata(mission, stored)).toThrow();
  }
});
