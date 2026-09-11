import { expect, test } from "@playwright/test";
import { generatedMissionHintSchema, missionHintResultSchema, missionHintFromRow, missionHintInstructions, missionHintRequestSchema, restoreMissionAssistance } from "../../src/entities/mission-run/model/mission-hint";
const id = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-09-11T01:00:00+00:00";

test("hint request rejects client transcript, invalid depths and malformed keys", () => {
  for (const depth of [1, 2, 3]) expect(missionHintRequestSchema.parse({ stepId: id, requestId: id, depth }).depth).toBe(depth);
  for (const depth of [0, 4, 1.5, "1"]) expect(missionHintRequestSchema.safeParse({ stepId: id, requestId: id, depth }).success).toBe(false);
  expect(missionHintRequestSchema.safeParse({ stepId: id, requestId: id, depth: 1, transcript: [] }).success).toBe(false);
  expect(missionHintRequestSchema.safeParse({ stepId: id, requestId: "retry", depth: 1 }).success).toBe(false);
});

test("persisted hint DTO preserves actual context and does not invent empty-history identifiers", () => {
  const row = { id, mission_run_id: id, mission_step_id: id, depth: 2, result: { text: "Could I ...", explanation: "정중하게 요청해요." }, created_at: timestamp, context_message_id: null, context_sequence_number: null };
  expect(missionHintFromRow(row)).toEqual({ id, runId: id, stepId: id, depth: 2, result: row.result, createdAt: timestamp, contextMessageId: undefined, contextSequenceNumber: undefined });
  expect(missionHintFromRow({ ...row, context_message_id: id, context_sequence_number: "12" }).contextSequenceNumber).toBe(12);
  expect(() => missionHintFromRow({ ...row, result: { text: "", explanation: "" } })).toThrow();
});

test("evaluation assistance restores a consistent snapshot but never declares legacy or corrupt data independent", () => {
  const assistance = { status: "tracked", requestCount: 3, maxDepth: 3, steps: [{ stepId: id, maxDepth: 3, requestCount: 3 }], capturedAt: timestamp };
  expect(restoreMissionAssistance({ assistance })).toEqual(assistance);
  expect(restoreMissionAssistance({ assistance: { ...assistance, status: "unknown" } })?.status).toBe("unknown");
  expect(restoreMissionAssistance({ assistance: { ...assistance, requestCount: 0, maxDepth: 0, steps: [] } })?.requestCount).toBe(0);
  for (const feedback of [null, [], {}, { assistance: { ...assistance, requestCount: 0 } }, { assistance: { ...assistance, maxDepth: 1 } }, { assistance: { ...assistance, requestCount: 6, steps: [...assistance.steps, ...assistance.steps] } }]) expect(restoreMissionAssistance(feedback)).toBeUndefined();
});

test("depth instruction contract separates intention, pattern and contextual sentence", () => {
  expect(missionHintInstructions(1)).toContain("Korean intention");
  expect(missionHintInstructions(2)).toContain("not a complete answer");
  expect(missionHintInstructions(3)).toContain("instead of inventing");
  for (const depth of [1, 2, 3] as const) expect(missionHintInstructions(depth)).toContain("only the requested depth");
});


test("new hints reject short or emoji-only explanations without invalidating saved legacy hints", () => {
  const text = "My name is [name], and I am staying for [number] nights.";
  const valid = { text, explanation: "이름과 숙박 일수를 빈칸에 넣어 정중하게 소개해 보세요." };
  expect(generatedMissionHintSchema.parse(valid)).toEqual(valid);
  for (const explanation of [":)", "잘했어요", "🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂", "Use this pattern to answer."]) {
    expect(generatedMissionHintSchema.safeParse({ text, explanation }).success).toBe(false);
    expect(missionHintResultSchema.safeParse({ text, explanation }).success).toBe(true);
  }
  expect(generatedMissionHintSchema.safeParse({ text: "Hi", explanation: valid.explanation }).success).toBe(false);
  for (const depth of [1, 2, 3] as const) expect(missionHintInstructions(depth)).toContain("even when it was already fulfilled");
  expect(missionHintInstructions(2)).toContain("Always include an explicit ellipsis");
});
