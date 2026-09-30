import { expect, test } from "@playwright/test";
import { generatedEvaluationAxesSchema, materializeEvaluationAxes, modernEvaluationAxisKeys, weightedEvaluationTotal, EvaluationRubricEvidenceError } from "../../src/entities/mission-run/model/evaluation-rubric";
import type { EvaluationAxis, MissionEvaluationMessage } from "../../src/entities/mission-run/model/types";

const learnerText = `  I would like a ticket. ${"x".repeat(600)}`;
const transcript: MissionEvaluationMessage[] = [
  { id: "learner", role: "user", text: learnerText },
  { id: "assistant", role: "assistant", text: "Invented perfect answer" },
];
const generated = () => Object.fromEntries(modernEvaluationAxisKeys.map((key) => [key, {
  score: 79.6, feedback: `${key} feedback`, evidence: [{ messageId: "learner", rationale: "Relevant saved sentence" }],
}]));

test("materializes exactly five axes with feedback and exact saved learner quotes without modifying legacy evaluations", () => {
  const legacy: EvaluationAxis[] = [{ key: "appropriateness", label: "상황 적절성", score: 67, evidence: [] }];
  const before = structuredClone(legacy);
  const input = generated();
  const axes = materializeEvaluationAxes(input, transcript);
  expect(axes.map((axis) => axis.label)).toEqual(["과업 달성", "이해 가능성", "문법", "어휘·표현", "상호작용"]);
  for (const axis of axes) {
    expect(axis.score).toBe(80);
    expect(axis.feedback).toBe(`${axis.key} feedback`);
    expect(axis.evidence).toEqual([{ messageId: "learner", quote: learnerText.slice(0, 500), rationale: "Relevant saved sentence" }]);
  }
  expect(legacy).toEqual(before);
  expect(input.taskCompletion.score).toBe(79.6);
});

test("every generated axis must have genuine learner evidence; assistant and fabricated IDs cannot support a score", () => {
  for (const key of modernEvaluationAxisKeys) {
    for (const messageId of ["assistant", "fabricated"]) {
      const input = generated();
      input[key].evidence = [{ messageId, rationale: "Not a learner source" }];
      expect(() => materializeEvaluationAxes(input, transcript)).toThrow(EvaluationRubricEvidenceError);
    }
  }
  expect(() => materializeEvaluationAxes(generated(), [{ id: "learner", role: "user", text: "  " }])).toThrow(EvaluationRubricEvidenceError);
  const mixed = generated();
  mixed.taskCompletion.evidence = [
    { messageId: "fabricated", rationale: "Ignore" }, { messageId: "assistant", rationale: "Ignore" },
    { messageId: "learner", rationale: "Keep" }, { messageId: "learner", rationale: "Duplicate" },
  ];
  expect(materializeEvaluationAxes(mixed, transcript)[0].evidence).toEqual([{ messageId: "learner", quote: learnerText.slice(0, 500), rationale: "Keep" }]);
});

test("rejects missing/legacy/extra axes, invalid numbers and feedback, or model-supplied quotes", () => {
  for (const score of [-1, 101, NaN, Infinity, "80", null]) {
    expect(generatedEvaluationAxesSchema.safeParse({ ...generated(), grammar: { ...generated().grammar, score } }).success).toBe(false);
  }
  for (const feedback of ["", " ", "x".repeat(1001), null]) {
    expect(generatedEvaluationAxesSchema.safeParse({ ...generated(), grammar: { ...generated().grammar, feedback } }).success).toBe(false);
  }
  const missing = generated(); delete missing.interaction;
  expect(() => materializeEvaluationAxes(missing, transcript)).toThrow();
  expect(() => materializeEvaluationAxes({ ...generated(), appropriateness: generated().grammar }, transcript)).toThrow();
  expect(() => materializeEvaluationAxes({ ...generated(), grammar: { ...generated().grammar, evidence: [{ messageId: "learner", rationale: "ok", quote: "forged" }] } }, transcript)).toThrow();
});

test("weights task completion40percent and all other axes15percent, rejecting legacy/duplicate score inputs", () => {
  const axes = materializeEvaluationAxes(generated(), transcript);
  for (const key of modernEvaluationAxisKeys) {
    const selected = axes.map((axis) => ({ ...axis, score: axis.key === key ? 100 : 0 }));
    expect(weightedEvaluationTotal(selected)).toBe(key === "taskCompletion" ? 40 : 15);
  }
  expect(weightedEvaluationTotal(axes)).toBe(80);
  expect(weightedEvaluationTotal([...axes].reverse())).toBe(80);
  expect(() => weightedEvaluationTotal([...axes.slice(0, 4), axes[0]])).toThrow();
  expect(() => weightedEvaluationTotal(axes.slice(0, 4))).toThrow();
  expect(() => weightedEvaluationTotal(axes.map((axis) => ({ ...axis, score: NaN })))).toThrow();
  expect(() => weightedEvaluationTotal(axes.map((axis) => axis.key === "interaction" ? { ...axis, key: "appropriateness" } : axis))).toThrow();
});
