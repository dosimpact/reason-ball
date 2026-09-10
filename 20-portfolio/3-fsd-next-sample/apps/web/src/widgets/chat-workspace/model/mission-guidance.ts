import type { Mission } from "@/entities/mission/model/types";
import type { MissionRun } from "@/entities/mission-run/model/types";

export type GuidanceStep = { id: string; label: string; hint: string; order: number };
export type MissionGuidance = {
  state: "loading" | "unavailable" | "active" | "review";
  steps: GuidanceStep[];
  currentStepId?: string;
};

// Only published display hints belong here, never evaluator success criteria.
export function buildMissionGuidance(mission: Mission, run?: MissionRun): MissionGuidance {
  if (!run) return { state: "loading", steps: [] };
  if (run.missionId !== mission.id) return { state: "unavailable", steps: [] };
  const definitions = mission.steps?.length ? mission.steps : mission.objectives;
  if (definitions.length !== run.steps.length ||
      new Set(definitions.map((step) => step.id)).size !== definitions.length ||
      new Set(run.steps.map((step) => step.id)).size !== run.steps.length) {
    return { state: "unavailable", steps: [] };
  }
  const ordered = [...run.steps].sort((left, right) => left.order - right.order);
  const steps: GuidanceStep[] = [];
  for (const progress of ordered) {
    const definition = definitions.find((step) => step.id === progress.id);
    if (!definition || !Number.isInteger(progress.order) || progress.order < 1) {
      return { state: "unavailable", steps: [] };
    }
    steps.push({ id: definition.id, label: definition.label, hint: definition.hint.trim(), order: progress.order });
  }
  if (!steps.length || new Set(steps.map((step) => step.order)).size !== steps.length) {
    return { state: "unavailable", steps: [] };
  }
  if (run.status === "passed" || run.status === "abandoned" || ordered.every((step) => step.status === "completed" || step.status === "skipped")) {
    return { state: "review", steps };
  }
  const active = ordered.filter((step) => step.status === "active");
  if (active.length !== 1 || active[0].order !== run.currentStepOrder) return { state: "unavailable", steps: [] };
  return { state: "active", steps, currentStepId: active[0].id };
}

export function selectGuidanceStep(guidance: MissionGuidance, previewId?: string) {
  const id = previewId || guidance.currentStepId;
  return guidance.steps.find((step) => step.id === id);
}

export function appendGuidanceHint(draft: string, hint: string) {
  if (!hint.trim()) return draft;
  return draft ? `${draft}${draft.endsWith("\n") ? "" : "\n"}${hint}` : hint;
}
