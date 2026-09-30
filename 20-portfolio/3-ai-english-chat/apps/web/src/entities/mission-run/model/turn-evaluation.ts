import { z } from "zod";
import { materializeEvaluationAxes, modernEvaluationAxisKeys } from "./evaluation-rubric";
import type { MissionEvaluationMessage } from "./types";

export const turnEvaluationRequestSchema = z.object({ conversationId: z.uuid(), messageId: z.uuid() }).strict();
export type TurnEvaluationRequest = z.infer<typeof turnEvaluationRequestSchema>;
const responseAxis = z.object({
  key: z.enum(modernEvaluationAxisKeys), label: z.string().min(1), score: z.number().int().min(0).max(100),
  feedback: z.string().min(1).max(1_000),
  evidence: z.array(z.object({ messageId: z.uuid(), quote: z.string().min(1).max(500), rationale: z.string().min(1).max(500) }).strict()).min(1),
}).strict();
export const turnEvaluationResponseSchema = z.object({
  source: z.literal("provider"), messageId: z.uuid(), targetText: z.string().trim().min(1).max(4_000),
  axes: z.array(responseAxis).length(5).refine((axes) => new Set(axes.map((axis) => axis.key)).size === 5),
}).strict();
export type TurnEvaluationResponse = z.infer<typeof turnEvaluationResponseSchema>;
export type TurnEvaluationRow = { id: string; role: string; author_id: string | null; status: string; parts: unknown; sequence_number: number };

function textFromParts(parts: unknown) {
  if (!Array.isArray(parts)) return "";
  return parts.flatMap((part: unknown) => {
    if (!part || typeof part !== "object") return [];
    const value = part as { type?: unknown; text?: unknown };
    return value.type === "text" && typeof value.text === "string" ? [value.text] : [];
  }).join("").trim();
}

/** Rows must come from the already ownership-checked conversation. */
export function selectTurnEvaluationContext(target: TurnEvaluationRow, previous: readonly TurnEvaluationRow[], ownerId: string) {
  if (target.role !== "user" || target.author_id !== ownerId || target.status !== "complete") throw new Error("Only a completed owned learner turn can be evaluated.");
  const text = z.string().min(1).max(4_000).parse(textFromParts(target.parts));
  const preceding = previous.filter((row) => row.sequence_number < target.sequence_number && row.status === "complete" && ["user", "assistant"].includes(row.role));
  if (preceding.some((row) => row.role === "user" && row.author_id !== ownerId)) throw new Error("Conversation contains a learner message from another owner.");
  const context = [...preceding].sort((a, b) => a.sequence_number - b.sequence_number).slice(-7).flatMap((row) => {
    const text = textFromParts(row.parts).slice(0, 4_000);
    return text ? [{ id: row.id, role: row.role as "user" | "assistant", text }] : [];
  });
  return { target: { id: target.id, role: "user" as const, text }, context };
}

export function materializeTurnEvaluation(input: unknown, target: MissionEvaluationMessage): TurnEvaluationResponse {
  return turnEvaluationResponseSchema.parse({ source: "provider", messageId: target.id, targetText: target.text,
    axes: materializeEvaluationAxes(input, [target]) });
}
