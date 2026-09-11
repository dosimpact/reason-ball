import { expect, test } from "@playwright/test";
import { compileMissionLearningFields, readMissionObjectives, readMissionPrerequisites } from "../../src/shared/api/supabase/mission-version-fields";

test("keeps learning goals and prerequisite IDs separate without mutating drafts", () => {
  const draft = { objectives: [{ id: "name", label: "Give your name", hint: "My name is" }], prerequisites: ["coffee-order"] };
  const before = structuredClone(draft);
  const fields = compileMissionLearningFields(draft);
  expect(fields).toEqual({ learningGoals: ["Give your name"], objectives: before.objectives, prerequisites: ["coffee-order"] });
  fields.prerequisites.push("another-mission");
  expect(draft).toEqual(before);
  expect(readMissionPrerequisites({ prerequisites: before.prerequisites, successThreshold: 75 })).toEqual(["coffee-order"]);
});

test("does not invent prerequisites from goals on versions without a condition", () => {
  expect(compileMissionLearningFields({ objectives: [{ id: "name", label: "Give your name", hint: "" }] })).toEqual({ learningGoals: ["Give your name"], objectives: [{ id: "name", label: "Give your name", hint: "" }], prerequisites: [] });
  for (const config of [undefined, null, {}, { successThreshold: 75 }, { prerequisites: [] }]) {
    expect(readMissionPrerequisites(config)).toEqual([]);
  }
});

test("rejects malformed explicit conditions instead of opening the mission", () => {
  for (const config of [[], "coffee-order", { prerequisites: null }, { prerequisites: "coffee-order" }, { prerequisites: [42] }, { prerequisites: [" "] }]) {
    expect(() => readMissionPrerequisites(config)).toThrow();
  }
});

test("authored goals and hints round trip independently from execution steps", () => {
  const draft = { objectives: [{ id: "hello", label: "Say hello", hint: "Hello!" }] };
  const compiled = compileMissionLearningFields(draft);
  const steps = [{ id: "greeting-step", label: "Greeting", hint: "Greet the partner" }];
  expect(readMissionObjectives({ objectives: compiled.objectives }, compiled.learningGoals, steps)).toEqual(draft.objectives);
  compiled.objectives[0].hint = "Changed compiled copy";
  expect(draft.objectives[0].hint).toBe("Hello!");
  expect(readMissionObjectives({}, ["Say hello"], steps)).toEqual([{ id: "goal-1", label: "Say hello", hint: "" }]);
  expect(readMissionObjectives({}, ["Greeting"], steps)).toEqual(steps);
  expect(readMissionObjectives({}, undefined, steps)).toEqual(steps);
});

test("malformed explicit goals are not replaced with execution steps", () => {
  expect(() => readMissionObjectives({ objectives: [{ id: "x", label: "", hint: "" }] }, ["Say hello"], [])).toThrow();
});
