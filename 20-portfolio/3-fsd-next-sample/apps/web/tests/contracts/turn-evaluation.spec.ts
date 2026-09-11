import { expect, test } from "@playwright/test";
import { selectTurnEvaluationContext, materializeTurnEvaluation, turnEvaluationRequestSchema, type TurnEvaluationRow } from "../../src/entities/mission-run/model/turn-evaluation";
import { modernEvaluationAxisKeys } from "../../src/entities/mission-run/model/evaluation-rubric";

const targetId = "b3381522-8c1e-48f8-8202-9c3be9d2a03d";
function row(id: string, sequence_number: number, overrides: Partial<TurnEvaluationRow> = {}): TurnEvaluationRow {
  return { id, sequence_number, author_id: "owner", role: "user", status: "complete", parts: [{ type: "text", text: `Turn ${sequence_number}` }], ...overrides };
}

test("selected turn uses only seven preceding completed messages and preserves target text independently of later corrections", () => {
  const target = row(targetId, 10, { parts: [{ type: "text", text: " Yesterday I go to Seoul. " }] });
  const previous = Array.from({ length: 12 }, (_, i) => row(String(i), i));
  const result = selectTurnEvaluationContext(target, previous, "owner");
  expect(result.target).toEqual({ id: targetId, role: "user", text: "Yesterday I go to Seoul." });
  expect(result.context.map(message => message.id)).toEqual(["3", "4", "5", "6", "7", "8", "9"]);
  expect(target.parts).toEqual([{ type: "text", text: " Yesterday I go to Seoul. " }]);
});

test("target selection rejects another owner, assistant, partial or overlong target and foreign learner context", () => {
  for (const overrides of [{ author_id: "outsider" }, { role: "assistant" }, { status: "streaming" }, { parts: [] }, { parts: [{ type: "text", text: "x".repeat(4001) }] }]) {
    expect(() => selectTurnEvaluationContext(row(targetId, 10, overrides), [], "owner")).toThrow();
  }
  expect(() => selectTurnEvaluationContext(row(targetId, 10), [row("other", 9, { author_id: "outsider" })], "owner")).toThrow();
  expect(turnEvaluationRequestSchema.safeParse({ conversationId: targetId, messageId: targetId, messages: [] }).success).toBe(false);
});

test("materialized turn axes can cite only the selected learner and never invent a total or completion decision", () => {
  const target = { id: targetId, role: "user" as const, text: "I wants two nights." };
  const generated = Object.fromEntries(modernEvaluationAxisKeys.map(key => [key, { score: 75, feedback: "다음에 사용할 전략입니다.", evidence: [{ messageId: targetId, rationale: "실제 답변에서 의도를 전달했어요." }] }]));
  const result = materializeTurnEvaluation(generated, target);
  expect(Object.keys(result).sort()).toEqual(["axes", "messageId", "source", "targetText"]);
  expect(result.axes).toHaveLength(5);
  for (const axis of result.axes) expect(axis.evidence).toEqual([{ messageId: targetId, quote: target.text, rationale: "실제 답변에서 의도를 전달했어요." }]);
  const invalid = structuredClone(generated);
  invalid.interaction.evidence[0].messageId = "b3381522-8c1e-48f8-8202-9c3be9d2a04d";
  expect(() => materializeTurnEvaluation(invalid, target)).toThrow("requires evidence");
});
