import { expect, test } from "@playwright/test";
import { seedMissions } from "../../src/shared/api/learning/mock-data";
import type { MissionRun } from "../../src/entities/mission-run/model/types";
import { appendGuidanceHint, buildMissionGuidance, selectGuidanceStep } from "../../src/widgets/chat-workspace/model/mission-guidance";

const mission = seedMissions[0];
const run: MissionRun = { id: "run", missionId: mission.id, missionTitle: mission.title, characterId: mission.recommendedCharacterId, status: "in-progress", currentStepOrder: 2, attemptNumber: 1, turnCount: 99,
  steps: mission.objectives.map((step, index) => ({ id: step.id, label: step.label, required: true, order: index + 1, status: index === 0 ? "completed" : index === 1 ? "active" : "locked", attempts: 0, evidenceMessageIds: [] })) };

test("guidance follows matching active step IDs, not message counts or definition order", () => {
  const shuffled = { ...mission, objectives: [...mission.objectives].reverse() };
  const before = structuredClone({ shuffled, run });
  const guidance = buildMissionGuidance(shuffled, run);
  expect(guidance.state).toBe("active");
  expect(selectGuidanceStep(guidance)).toMatchObject({ id: "passport", hint: "Here is my passport." });
  expect(selectGuidanceStep(guidance, "breakfast")?.hint).toBe("What time is breakfast?");
  expect(selectGuidanceStep(guidance, "unknown")).toBeUndefined();
  expect({ shuffled, run }).toEqual(before);
});

test("missing, mismatched, ambiguous and incomplete run data do not invent a current step", () => {
  expect(buildMissionGuidance(mission).state).toBe("loading");
  expect(buildMissionGuidance(mission, { ...run, missionId: "other" }).state).toBe("unavailable");
  expect(buildMissionGuidance(mission, { ...run, currentStepOrder: 1 }).state).toBe("unavailable");
  expect(buildMissionGuidance(mission, { ...run, steps: run.steps.slice(1) }).state).toBe("unavailable");
  for (const steps of [[], [...run.steps, run.steps[0]], run.steps.map((step) => ({ ...step, status: "active" as const })), run.steps.map((step) => ({ ...step, id: "unmapped" })), run.steps.map((step) => ({ ...step, order: 1 }))]) {
    expect(buildMissionGuidance(mission, { ...run, steps }).state).toBe("unavailable");
  }
  expect(buildMissionGuidance({ ...mission, objectives: [...mission.objectives, mission.objectives[0]] }, run).state).toBe("unavailable");
});

test("finished runs offer explicit review only and empty hints remain empty", () => {
  const review = buildMissionGuidance(mission, { ...run, status: "passed" });
  expect(review.state).toBe("review");
  expect(selectGuidanceStep(review)).toBeUndefined();
  expect(selectGuidanceStep(review, "passport")?.hint).toBe("Here is my passport.");
  const noHint = { ...mission, objectives: mission.objectives.map((step) => ({ ...step, hint: "   " })) };
  expect(selectGuidanceStep(buildMissionGuidance(noHint, run))?.hint).toBe("");
});

test("inserting a hint preserves the entire draft and does not insert blank hints", () => {
  expect(appendGuidanceHint("My draft", "Hint")).toBe("My draft\nHint");
  expect(appendGuidanceHint("My draft\n", "Hint")).toBe("My draft\nHint");
  expect(appendGuidanceHint("", "Hint")).toBe("Hint");
  expect(appendGuidanceHint("Keep spaces  ", " ")).toBe("Keep spaces  ");
});

test("all required goals achieved permits review while optional goals remain available", () => {
  const steps = run.steps.map((step, index) => ({ ...step, required: index === 0, status: index === 0 ? "completed" as const : "locked" as const }));
  const guidance = buildMissionGuidance(mission, { ...run, steps });
  expect(guidance.state).toBe("review");
  expect(guidance.currentStepId).toBeUndefined();
  expect(selectGuidanceStep(guidance, steps[1].id)?.id).toBe(steps[1].id);
});
