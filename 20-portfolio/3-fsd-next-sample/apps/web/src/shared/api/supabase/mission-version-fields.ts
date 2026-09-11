import { z } from "zod";
import type { MissionDraft } from "../learning/contracts";

const prerequisiteConfigSchema = z.object({
  prerequisites: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
});

// Adapter serialization only: learning text must never stand in for mission IDs.
export function compileMissionLearningFields(
  draft: Pick<MissionDraft, "objectives" | "prerequisites">,
) {
  return {
    learningGoals: draft.objectives.map((objective) => objective.label),
    objectives: draft.objectives.map((objective) => ({ ...objective })),
    prerequisites: [...(draft.prerequisites ?? [])],
  };
}

export function readMissionPrerequisites(evaluatorConfig: unknown): string[] {
  // Older versions have no explicit condition. Malformed present conditions fail
  // validation instead of silently turning a restricted mission into an open one.
  return prerequisiteConfigSchema.parse(evaluatorConfig ?? {}).prerequisites ?? [];
}

const objectiveConfigSchema = z.object({
  objectives: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(500),
    hint: z.string().trim().max(1_000),
  }).strict()).min(1).max(30).optional(),
});

export function readMissionObjectives(
  evaluatorConfig: unknown,
  learningGoals: unknown,
  legacySteps: MissionDraft["objectives"],
): MissionDraft["objectives"] {
  const explicit = objectiveConfigSchema.parse(evaluatorConfig ?? {}).objectives;
  if (explicit) return explicit;
  // Old versions stored labels only. Reuse step IDs/hints only when the labels
  // actually match; an independent execution step must not replace a goal.
  const labels = z.array(z.string().min(1)).safeParse(learningGoals);
  if (labels.success && labels.data.length) return labels.data.map((label, index) => {
    const step = legacySteps.find((item) => item.label === label);
    return { id: step?.id ?? `goal-${index + 1}`, label, hint: step?.hint ?? "" };
  });
  return legacySteps.map((step) => ({ ...step }));
}
