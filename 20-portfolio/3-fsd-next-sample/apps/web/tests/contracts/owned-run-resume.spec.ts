import { expect, test } from "@playwright/test";
import { resumeOwnedRun } from "../../src/app/api/mission-runs/_lib/resume-owned-run";

const input = { ownerId: "owner", conversationId: "chat", missionId: "mission", characterId: "character" };
const conversation = { id: "chat", owner_id: "owner", status: "active", mission_id: "mission", mission_version_id: "old-mission-version", character_id: "character", character_version_id: "old-character-version" };
const run = { ...conversation, conversation_id: "chat", status: "passed", score: 95 };

function fixture() {
  const calls: string[] = [];
  const ports = {
    async conversation(id: string, ownerId: string) { calls.push(`conversation:${id}:${ownerId}`); return conversation; },
    async run(id: string, ownerId: string) { calls.push(`run:${id}:${ownerId}`); return run; },
    async slug(table: "missions" | "characters", id: string) { calls.push(`${table}:${id}`); return `${id}-slug`; },
  };
  return { calls, ports };
}

test("resumes pinned completed context without looking up current publication or aliases", async () => {
  const { calls, ports } = fixture();
  const before = structuredClone(run);
  expect(await resumeOwnedRun(input, ports)).toEqual({ kind: "resume", run });
  expect(calls).toEqual(["conversation:chat:owner", "run:chat:owner"]);
  expect(run).toEqual(before);
});

test("resolves aliases only for resources attached to the owned run", async () => {
  const { calls, ports } = fixture();
  expect(await resumeOwnedRun({ ...input, missionId: "mission-slug", characterId: "character-slug" }, ports)).toEqual({ kind: "resume", run });
  expect(calls).toEqual(["conversation:chat:owner", "run:chat:owner", "missions:mission", "characters:character"]);
  expect(await resumeOwnedRun({ ...input, missionId: "unrelated" }, ports)).toEqual({ kind: "conflict" });
});

test("rejects missing, foreign, inactive or incorrectly selected conversations before run reads", async () => {
  for (const value of [undefined, { ...conversation, owner_id: "other" }, { ...conversation, status: "archived" }, { ...conversation, id: "other" }]) {
    const { calls, ports } = fixture();
    expect(await resumeOwnedRun(input, { ...ports, conversation: async () => value })).toEqual({ kind: "conflict" });
    expect(calls).toEqual([]);
  }
});

test("rejects foreign runs and every mismatched pinned field before privileged reads", async () => {
  for (const key of ["owner_id", "conversation_id", "mission_id", "mission_version_id", "character_id", "character_version_id"] as const) {
    const { calls, ports } = fixture();
    expect(await resumeOwnedRun(input, { ...ports, run: async () => ({ ...run, [key]: "other" }) })).toEqual({ kind: "conflict" });
    expect(calls).toEqual(["conversation:chat:owner"]);
  }
});

test("leaves new starts to the creation path and propagates storage failure", async () => {
  const { calls, ports } = fixture();
  expect(await resumeOwnedRun({ ...input, conversationId: undefined }, ports)).toEqual({ kind: "create" });
  expect(calls).toEqual([]);
  expect(await resumeOwnedRun(input, { ...ports, run: async () => undefined })).toEqual({ kind: "create" });
  await expect(resumeOwnedRun(input, { ...ports, conversation: async () => { throw new Error("unavailable"); } })).rejects.toThrow("unavailable");
});
