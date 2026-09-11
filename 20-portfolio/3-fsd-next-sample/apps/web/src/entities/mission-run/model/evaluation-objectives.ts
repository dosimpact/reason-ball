/** Restore only this evaluation's server-validated snapshot, never accumulated progress. */
export function restoreEvaluationObjectiveIds(feedback: unknown, knownStepIds: readonly string[]): string[] {
  if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) return [];
  const snapshot = (feedback as Record<string, unknown>).completedStepIds;
  // Older evaluations have no trustworthy per-evaluation snapshot. Their score,
  // feedback and awards remain intact, but objective attribution is unavailable.
  // Raw provider output and current progress cannot safely reconstruct it.
  if (!Array.isArray(snapshot)) return [];
  const known = new Set(knownStepIds);
  return [...new Set(snapshot.filter((id): id is string => typeof id === "string" && known.has(id)))];
}
