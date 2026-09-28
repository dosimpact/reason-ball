import { z } from "zod";
import { candleSchema } from "@/entities/candle/@x";

export const dataProfileSchema = z.enum(["T", "D60", "D60R", "D96", "D96R", "H", "HR", "M", "L"]);
export type DataProfile = z.infer<typeof dataProfileSchema>;
export const lessonFieldSchema = z.strictObject({
  key: z.string().min(1), label: z.string().min(1), kind: z.enum(["points", "number", "choice", "text", "analysis"]),
  required: z.boolean(), options: z.array(z.string()).optional(), count: z.number().int().positive().optional(),
  help: z.string().optional(),
});
export type LessonField = z.infer<typeof lessonFieldSchema>;
export const lessonQuestionSchema = z.strictObject({ id: z.string(), prompt: z.string(), options: z.array(z.string()).min(2) });
export type LessonQuestion = z.infer<typeof lessonQuestionSchema>;
export const lessonStepSchema = z.strictObject({ title: z.string(), body: z.string(), visibleCount: z.number().int().positive(), focusIndices: z.array(z.number().int().nonnegative()) });
export type LessonStep = z.infer<typeof lessonStepSchema>;
export const caseViewSchema = z.strictObject({
  id: z.string(), title: z.string(), objective: z.string(), profile: dataProfileSchema,
  source: z.enum(["authored-dummy", "binance-historical", "binance-recent"]),
  sourceNote: z.string(), visibleCount: z.number().int().nonnegative(), totalCount: z.number().int().positive(),
  instruction: z.string(), fields: z.array(lessonFieldSchema).min(1),
  phase: z.enum(["basic", "counterexample", "assessment"]),
  canReveal: z.boolean(),
});
export type CaseView = z.infer<typeof caseViewSchema>;
export const learningViewSchema = z.strictObject({
  kind: z.enum(["theory", "practice"]), profile: dataProfileSchema, snapshotId: z.string().optional(), asOf: z.number().int().nonnegative().optional(), timeframes: z.strictObject({"1h": z.array(candleSchema), "4h": z.array(candleSchema), "1d": z.array(candleSchema)}).optional(),
  steps: z.array(lessonStepSchema).optional(), stepIndex: z.number().int().nonnegative().default(0), stepCount: z.number().int().nonnegative().default(0), questions: z.array(lessonQuestionSchema).optional(),
  currentCase: caseViewSchema.optional(), caseIndex: z.number().int().nonnegative().default(0), caseCount: z.number().int().positive().default(1),
  submitted: z.boolean().default(false), feedback: z.array(z.string()).default([]),
  objectivePassed: z.boolean().default(false), selfAssessment: z.boolean().default(false),
});
export type LearningView = z.infer<typeof learningViewSchema>;
export const analysisHypothesisSchema = z.strictObject({
  pattern: z.string().trim().min(1), direction: z.enum(["up", "down", "sideways", "uncertain"]), degree: z.string().trim().min(1),
  segments: z.array(z.strictObject({ id: z.string().trim().min(1), parentId: z.string().trim().min(1).optional(), label: z.string().trim().min(1), degree: z.string().trim().min(1), startIndex: z.number().int().nonnegative(), endIndex: z.number().int().nonnegative(), childLabels: z.array(z.string()).default([]) })).default([]),
  evidence: z.string().trim().min(1), invalidation: z.string().trim().min(1),
});
export const analysisPlanSchema = z.strictObject({
  primary: analysisHypothesisSchema, alternate: analysisHypothesisSchema.optional(), abstainReason: z.string().trim().min(1).optional(),
  rules: z.string().trim().min(1), guidelines: z.string().trim().min(1), anchors: z.string().trim().min(1),
  nextObservation: z.string().trim().min(1), asOf: z.number().int().nonnegative(), snapshotId: z.string().min(1),
  optionalTrade: z.strictObject({ entry: z.number().positive(), stop: z.number().positive(), target: z.number().positive(), exitStrategy: z.string().min(1) }).optional(),
});
export type AnalysisPlan = z.infer<typeof analysisPlanSchema>;
export const analysisRevisionSchema = z.strictObject({ schemaVersion: z.literal("2"), id: z.uuid(), caseId: z.string(), revision: z.number().int().positive(), previousPlanId: z.uuid().nullable(), createdAt: z.iso.datetime(), plan: analysisPlanSchema });
export const analysisEvaluationSchema = z.strictObject({ id: z.uuid(), caseId: z.string(), planId: z.uuid(), mode: z.enum(["replay", "later-market"]), observedFrom: z.number().int().nonnegative(), observedThrough: z.number().int().nonnegative(), createdAt: z.iso.datetime(), objectiveFeedback: z.array(z.string()), observation: z.string(), tradeResult: z.string().optional() });
export const analysisStateSchema = z.strictObject({ plans: z.array(analysisRevisionSchema), activePlanId: z.uuid().nullable(), evaluations: z.array(analysisEvaluationSchema), reflections: z.array(z.strictObject({ planId: z.uuid(), caseId: z.string(), reason: z.string(), createdAt: z.iso.datetime() })).default([]), reflection: z.strictObject({ planId: z.uuid(), caseId: z.string(), reason: z.string(), createdAt: z.iso.datetime() }).nullable() });
export type AnalysisState = z.infer<typeof analysisStateSchema>;

export const learningSubmissionSchema = z.strictObject({
  answers: z.record(z.string(), z.number().int().nonnegative()).optional(),
  caseId: z.string().optional(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.number()), z.array(z.string()), analysisPlanSchema])).optional(),
  rubric: z.array(z.number().int().min(0).max(2)).length(5).optional(),
  observedAt: z.number().int().nonnegative().optional(), reflection: z.string().optional(),
});
export type LearningSubmission = z.infer<typeof learningSubmissionSchema>;
export const learningGradeSchema = z.strictObject({ passed: z.boolean(), objectivePassed: z.boolean(), selfAssessmentPassed: z.boolean(), score: z.number().int().nonnegative(), feedback: z.array(z.string()), acceptedValues: z.record(z.string(), z.unknown()).optional() });
export type LearningGrade = z.infer<typeof learningGradeSchema>;

export function gradeRubric(scores: readonly number[]): boolean {
  return scores.length === 5 && scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 2) && scores.reduce((sum, score) => sum + score, 0) >= 8;
}
export function gradeQuiz(correct: readonly number[], answers: Record<string, number>): LearningGrade {
  const score = correct.reduce((total, answer, index) => total + Number(answers[`q${index + 1}`] === answer), 0);
  return { passed: score >= 2, objectivePassed: score >= 2, selfAssessmentPassed: true, score, feedback: [score >= 2 ? "확인 질문 3개 중 2개 이상을 맞혔습니다." : "규칙·가이드라인과 공개된 차트 근거를 다시 살펴보세요."] };
}

export { validateWaveStructure, validateAnalysisPlan, validateCorrectionSegments, validateMultiscaleSelection, validateFlatVariant } from "./wave-structure";
export type { PatternPolicy, StructureCheck } from "./wave-structure";
