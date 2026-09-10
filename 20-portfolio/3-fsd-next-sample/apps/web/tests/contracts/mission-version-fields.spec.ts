import { expect, test } from "@playwright/test";
import { compileMissionLearningFields, readMissionPrerequisites } from "../../src/shared/api/supabase/mission-version-fields";

test("keeps learning goals and prerequisite IDs separate without mutating drafts", () => {
  const draft = { objectives: [{ id: "name", label: "Give your name", hint: "My name is" }], prerequisites: ["coffee-order"] };
  const before = structuredClone(draft);
  const fields = compileMissionLearningFields(draft);
  expect(fields).toEqual({ learningGoals: ["Give your name"], prerequisites: ["coffee-order"] });
  fields.prerequisites.push("another-mission");
  expect(draft).toEqual(before);
  expect(readMissionPrerequisites({ prerequisites: before.prerequisites, successThreshold: 75 })).toEqual(["coffee-order"]);
});

test("does not invent prerequisites from goals on versions without a condition", () => {
  expect(compileMissionLearningFields({ objectives: [{ id: "name", label: "Give your name", hint: "" }] })).toEqual({ learningGoals: ["Give your name"], prerequisites: [] });
  for (const config of [undefined, null, {}, { successThreshold: 75 }, { prerequisites: [] }]) {
    expect(readMissionPrerequisites(config)).toEqual([]);
  }
});

test("rejects malformed explicit conditions instead of opening the mission", () => {
  for (const config of [[], "coffee-order", { prerequisites: null }, { prerequisites: "coffee-order" }, { prerequisites: [42] }, { prerequisites: [" "] }]) {
    expect(() => readMissionPrerequisites(config)).toThrow();
  }
});
