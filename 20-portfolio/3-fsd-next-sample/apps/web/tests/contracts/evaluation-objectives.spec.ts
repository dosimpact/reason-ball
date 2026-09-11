import { expect, test } from "@playwright/test";
import { restoreEvaluationObjectiveIds } from "../../src/entities/mission-run/model/evaluation-objectives";

test("an edited re-evaluation restores its own objective, not all known or previously achieved objectives", () => {
  const known = ["greeting", "price"];
  expect(restoreEvaluationObjectiveIds({ completedStepIds: ["price"] }, known)).toEqual(["price"]);
  expect(restoreEvaluationObjectiveIds({ completedStepIds: ["greeting"] }, known)).toEqual(["greeting"]);
  expect(restoreEvaluationObjectiveIds({ completedStepIds: [] }, known)).toEqual([]);
});

test("unknown steps, malformed entries and duplicate attribution never escape restoration", () => {
  expect(restoreEvaluationObjectiveIds({ completedStepIds: ["other-version", null, 4, {}, "price", "price", "greeting"] }, ["greeting", "price"]))
    .toEqual(["price", "greeting"]);
  expect(restoreEvaluationObjectiveIds({ completedStepIds: ["price"] }, [])).toEqual([]);
});

test("legacy or invalid snapshots never infer objectives from provider output or cumulative progress", () => {
  for (const feedback of [undefined, null, [], "invalid", {}, { completedStepIds: "price" }, { completedStepIds: { price: true } },
    { summary: "Passed", completedSteps: [{ stepId: "price" }], raw_response: { completedSteps: [{ stepId: "price" }] } }]) {
    expect(restoreEvaluationObjectiveIds(feedback, ["price"])).toEqual([]);
  }
});
