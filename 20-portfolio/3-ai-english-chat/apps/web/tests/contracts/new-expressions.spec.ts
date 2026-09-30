import { expect, test } from "@playwright/test";
import { generatedNewExpressionsSchema, restoreNewExpressions } from "../../src/entities/mission-run/model/new-expressions";

test("provider expressions restore from the saved evaluation snapshot without changing meaning or mutating source", () => {
  const expressions = generatedNewExpressionsSchema.parse([
    { english: "Could I check in under Alex Kim?", meaning: "Alex Kim 이름으로 체크인할 수 있을까요?" },
    { english: "Is breakfast served at 7:30?", meaning: "아침 식사는 7시 30분에 제공되나요?" },
  ]);
  const feedback = Object.freeze({ newExpressions: Object.freeze(expressions.map(item => Object.freeze(item))), summary: "Keep practicing" });
  expect(restoreNewExpressions(feedback)).toEqual(expressions);
  const restored = restoreNewExpressions(feedback);
  restored[0].meaning = "Changed only in returned object";
  expect(restoreNewExpressions(feedback)).toEqual(expressions);
});

test("legacy and malformed feedback cannot masquerade as translated new expressions", () => {
  for (const feedback of [null, undefined, [], "text", {}, { vocabularyObserved: ["hotel"] },
    { corrections: [{ suggested: "Hello", explanation: "인사" }] },
    { newExpressions: [{ english: "Hello" }] }, { newExpressions: [{ english: "", meaning: "인사" }] },
    { newExpressions: [{ english: "Hello", meaning: "인사", source: "invented" }] },
    { newExpressions: Array.from({ length: 4 }, () => ({ english: "Hello", meaning: "인사" })) }]) {
    expect(restoreNewExpressions(feedback)).toEqual([]);
  }
  expect(restoreNewExpressions({ newExpressions: [] })).toEqual([]);
  expect(generatedNewExpressionsSchema.safeParse([]).success).toBe(false);
  expect(generatedNewExpressionsSchema.safeParse([{ english: "x".repeat(301), meaning: "뜻" }]).success).toBe(false);
  expect(generatedNewExpressionsSchema.safeParse([{ english: "Hello", meaning: "뜻".repeat(501) }]).success).toBe(false);
});
