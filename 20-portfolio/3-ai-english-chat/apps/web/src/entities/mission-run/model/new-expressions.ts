import { z } from "zod";
import type { MissionNewExpression } from "./types";

export const missionNewExpressionSchema = z.object({
  english: z.string().trim().min(1).max(300).describe("A short reusable English expression for this mission; preserve names and numbers when needed."),
  meaning: z.string().trim().min(1).max(500).describe("Explain the expression's meaning in concise Korean. English names and quoted terms are allowed."),
}).strict();
export const generatedNewExpressionsSchema = z.array(missionNewExpressionSchema).min(1).max(3);
const savedNewExpressionsSchema = z.array(missionNewExpressionSchema).max(3);

// Old evaluations have no expression snapshot. Do not invent translations from
// vocabularyObserved, corrections, or the learner's later notebook entries.
export function restoreNewExpressions(feedback: unknown): MissionNewExpression[] {
  if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) return [];
  const parsed = savedNewExpressionsSchema.safeParse((feedback as Record<string, unknown>).newExpressions);
  return parsed.success ? parsed.data : [];
}
