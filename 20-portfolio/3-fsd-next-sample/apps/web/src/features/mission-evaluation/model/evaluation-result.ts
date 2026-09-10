import type { MissionEvaluationResponse, MissionRun } from "@/entities/mission-run";

export function restoreEvaluationResult(run?: MissionRun): MissionEvaluationResponse | undefined {
  if (!run?.evaluation) return undefined;
  return { evaluation: run.evaluation, rewardId: run.rewardId, run };
}
