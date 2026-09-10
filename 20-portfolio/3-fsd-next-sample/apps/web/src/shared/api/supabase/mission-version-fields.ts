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
    prerequisites: [...(draft.prerequisites ?? [])],
  };
}

export function readMissionPrerequisites(evaluatorConfig: unknown): string[] {
  // Older versions have no explicit condition. Malformed present conditions fail
  // validation instead of silently turning a restricted mission into an open one.
  return prerequisiteConfigSchema.parse(evaluatorConfig ?? {}).prerequisites ?? [];
}
