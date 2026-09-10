import { expect, test } from "@playwright/test";
import { planMissionRunStart } from "../../src/entities/mission-run/model/resume-policy";
import type { MissionRunStatus } from "../../src/entities/mission-run/model/types";

const input = { missionId: "hotel", characterId: "mia", conversationId: "chat-a" };

test("restores the exact conversation in every state without changing its result", () => {
  for (const status of ["not-started", "in-progress", "evaluating", "passed", "failed", "abandoned"] satisfies MissionRunStatus[]) {
    const run = { ...input, status, score: 90 };
    const before = structuredClone(run);
    expect(planMissionRunStart([run], input)).toEqual({ kind: "resume", run });
    expect(run).toEqual(before);
  }
});

test("creates a fresh run for a different conversation even while another is active", () => {
  expect(planMissionRunStart([{ ...input, status: "in-progress" }], { ...input, conversationId: "chat-b" })).toEqual({ kind: "create" });
  expect(planMissionRunStart([], input)).toEqual({ kind: "create" });
});

test("rejects reusing a conversation for a different mission or character", () => {
  const run = { ...input, status: "passed" as const };
  expect(planMissionRunStart([run], { ...input, missionId: "cafe" })).toEqual({ kind: "conflict" });
  expect(planMissionRunStart([run], { ...input, characterId: "leo" })).toEqual({ kind: "conflict" });
});

test("legacy requests without a conversation resume only the same character's active run", () => {
  const runs = [{ ...input, status: "passed" as const }, { ...input, characterId: "leo", status: "in-progress" as const }];
  expect(planMissionRunStart(runs, { missionId: "hotel", characterId: "mia" })).toEqual({ kind: "create" });
  expect(planMissionRunStart(runs, { missionId: "hotel", characterId: "leo" })).toEqual({ kind: "resume", run: runs[1] });
});
