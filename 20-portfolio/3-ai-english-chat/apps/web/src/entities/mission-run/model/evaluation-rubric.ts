import { z } from "zod";
import type { EvaluationAxis, MissionEvaluationMessage } from "./types";

export const modernEvaluationAxisKeys = ["taskCompletion", "comprehensibility", "grammar", "vocabulary", "interaction"] as const;
export const modernEvaluationRubricVersion = 2 as const;
export const modernEvaluationWeights = { taskCompletion: 0.4, comprehensibility: 0.15, grammar: 0.15, vocabulary: 0.15, interaction: 0.15 } as const;
export type ModernEvaluationAxisKey = typeof modernEvaluationAxisKeys[number];
export const modernEvaluationAxisLabels: Record<ModernEvaluationAxisKey, string> = {
  taskCompletion: "과업 달성",
  comprehensibility: "이해 가능성",
  grammar: "문법",
  vocabulary: "어휘·표현",
  interaction: "상호작용",
};
export const generatedEvaluationAxisSchema = z.object({
  score: z.number().min(0).max(100),
  evidence: z.array(z.object({
    messageId: z.string().trim().min(1).max(200),
    rationale: z.string().trim().min(1).max(500),
  }).strict()).min(1).max(6),
  feedback: z.string().trim().min(1).max(1_000),
}).strict();
export const generatedEvaluationAxesSchema = z.object({
  taskCompletion: generatedEvaluationAxisSchema,
  comprehensibility: generatedEvaluationAxisSchema,
  grammar: generatedEvaluationAxisSchema,
  vocabulary: generatedEvaluationAxisSchema,
  interaction: generatedEvaluationAxisSchema,
}).strict();

export class EvaluationRubricEvidenceError extends Error {
  constructor(key: ModernEvaluationAxisKey) {
    super(`Evaluation axis ${key} requires evidence from a saved learner message.`);
    this.name = "EvaluationRubricEvidenceError";
  }
}

/** The caller supplies the owner-validated authoritative transcript, never browser/model text. */
export function materializeEvaluationAxes(input: unknown, transcript: readonly MissionEvaluationMessage[]): EvaluationAxis[] {
  const generated = generatedEvaluationAxesSchema.parse(input);
  const messages = new Map(transcript.filter((message) => message.role === "user" && message.text.trim()).map((message) => [message.id, message]));
  return modernEvaluationAxisKeys.map((key) => {
    const axis = generated[key];
    const seen = new Set<string>();
    const evidence = axis.evidence.flatMap((item) => {
      const message = messages.get(item.messageId);
      if (!message || seen.has(message.id)) return [];
      seen.add(message.id);
      return [{ messageId: message.id, quote: message.text.slice(0, 500), rationale: item.rationale }];
    });
    if (!evidence.length) throw new EvaluationRubricEvidenceError(key);
    return { key, label: modernEvaluationAxisLabels[key], score: Math.round(axis.score), evidence, feedback: axis.feedback };
  });
}

/** Only freshly generated modern evaluations use this formula; historical totals are stored facts. */
export function weightedEvaluationTotal(axes: readonly EvaluationAxis[]): number {
  const values = z.array(z.object({
    key: z.enum(modernEvaluationAxisKeys),
    score: z.number().min(0).max(100),
  })).length(modernEvaluationAxisKeys.length).parse(axes);
  const scores = new Map(values.map((axis) => [axis.key, axis.score]));
  if (scores.size !== modernEvaluationAxisKeys.length) throw new Error("Evaluation requires each modern axis exactly once.");
  return Math.round(modernEvaluationAxisKeys.reduce((total, key) => total + scores.get(key)! * modernEvaluationWeights[key], 0));
}
