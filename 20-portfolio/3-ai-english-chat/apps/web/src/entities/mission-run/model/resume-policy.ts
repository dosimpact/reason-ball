import type { MissionRun, StartMissionRunInput } from "./types";

type RunContext = Pick<MissionRun, "missionId" | "characterId" | "conversationId" | "status">;
type ResumePlan<T> = { kind: "create" } | { kind: "resume"; run: T } | { kind: "conflict" };

// Callers must scope runs to the authenticated owner/session before selection.
export function planMissionRunStart<T extends RunContext>(
  runs: readonly T[],
  input: Pick<StartMissionRunInput, "missionId" | "characterId" | "conversationId">,
): ResumePlan<T> {
  const matchesContext = (run: T) => run.missionId === input.missionId && run.characterId === input.characterId;
  if (input.conversationId) {
    const run = runs.find((item) => item.conversationId === input.conversationId);
    if (!run) return { kind: "create" };
    // A completed conversation restores its result; retaking requires a new chat.
    return matchesContext(run) ? { kind: "resume", run } : { kind: "conflict" };
  }
  const run = runs.find((item) => matchesContext(item) && ["not-started", "in-progress", "evaluating"].includes(item.status));
  return run ? { kind: "resume", run } : { kind: "create" };
}
