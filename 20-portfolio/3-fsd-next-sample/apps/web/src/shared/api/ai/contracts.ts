import { z } from "zod";

export const cefrLevelSchema = z.enum([
  "PRE_A1",
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
]);

const shortText = z.string().trim().min(1).max(160);
const paragraph = z.string().trim().min(1).max(2_000);
const uiMessagePartSchema = z
  .object({
    type: z.string().trim().min(1).max(80),
  })
  .loose();

const uiMessageSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    role: z.enum(["user", "assistant"]),
    metadata: z.unknown().optional(),
    parts: z.array(uiMessagePartSchema).min(1).max(100),
  })
  .strict();

const speakingStyleSchema = z
  .object({
    tone: shortText.optional(),
    responseLength: z.enum(["short", "medium"]).optional(),
    accent: shortText.optional(),
    voice: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const characterContextSchema = z
  .object({
    id: z.string().trim().min(1).max(200).optional(),
    name: shortText,
    tagline: shortText.optional(),
    role: shortText.optional(),
    background: paragraph.optional(),
    personality: paragraph.optional(),
    personalitySummary: paragraph.optional(),
    personalityTraits: z.array(shortText).max(12).optional(),
    goal: paragraph.optional(),
    personaGoal: paragraph.optional(),
    learningGoal: paragraph.optional(),
    tutorStyle: paragraph.optional(),
    correctionMode: z.enum(["gentle", "immediate", "summary"]).optional(),
    learnerLevel: cefrLevelSchema.optional(),
    greeting: paragraph.optional(),
    boundaries: z.array(shortText).max(20).optional(),
    speakingStyle: z.union([paragraph, speakingStyleSchema]).optional(),
  })
  .strict();

const missionObjectiveContextSchema = z
  .object({
    id: z.string().trim().min(1).max(120).optional(),
    label: shortText,
    successEvidence: z.array(shortText).max(10).optional(),
    required: z.boolean().optional(),
  })
  .strict();

export const missionContextSchema = z
  .object({
    id: z.string().trim().min(1).max(200).optional(),
    title: shortText,
    place: shortText.optional(),
    situation: paragraph.optional(),
    objective: paragraph.optional(),
    objectives: z
      .array(z.union([shortText, missionObjectiveContextSchema]))
      .max(12)
      .optional(),
    learnerRole: shortText.optional(),
    characterRole: shortText.optional(),
    level: cefrLevelSchema.optional(),
    durationMinutes: z.number().int().min(1).max(120).optional(),
    targetExpressions: z.array(shortText).max(30).optional(),
    minTurns: z.number().int().min(1).max(100).optional(),
    maxTurns: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const chatScenarioSchema = z.enum([
  "chat-default",
  "chat-hotel-success",
  "chat-correction",
  "chat-slow",
  "chat-error",
  "chat-tool-approval",
]);

export const chatRequestSchema = z
  .object({
    conversationId: z.uuid().optional(),
    // Parsed by the owning learner slice, and accepted only in mock runtime.
    learnerPreferences: z.unknown().optional(),
    messages: z.array(uiMessageSchema).min(1).max(200),
    modelId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9._:-]+$/)
      .optional(),
    character: characterContextSchema.optional(),
    mission: missionContextSchema.optional(),
    scenario: chatScenarioSchema.optional(),
  })
  .strict();

export const imageKindSchema = z.enum(["avatar", "reward", "artifact"]);

export const imageRequestSchema = z
  .object({
    kind: imageKindSchema,
    prompt: z.string().trim().min(10).max(1_200),
    size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1024"),
  })
  .strict();

export const speechRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(4_000),
    voice: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]{1,40}$/)
      .default("marin"),
    speed: z.number().min(0.5).max(2).default(1),
  })
  .strict();

export const missionDraftScenarioSchema = z.enum(["mission-hotel-draft"]);

export const missionDraftRequestSchema = z
  .object({
    topic: z.string().trim().min(3).max(160),
    level: cefrLevelSchema.default("A1"),
    durationMinutes: z.number().int().min(3).max(60).default(10),
    place: shortText.optional(),
    learnerRole: shortText.optional(),
    characterRole: shortText.optional(),
    scenario: missionDraftScenarioSchema.optional(),
  })
  .strict();

const missionDraftObjectiveSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    label: shortText,
    successEvidence: z.array(shortText).min(1).max(6),
    required: z.boolean(),
  })
  .strict();

export const missionDraftSchema = z
  .object({
    title: shortText,
    place: shortText,
    situation: paragraph,
    learnerRole: shortText,
    characterRole: shortText,
    level: cefrLevelSchema,
    durationMinutes: z.number().int().min(3).max(60),
    objectives: z.array(missionDraftObjectiveSchema).min(2).max(6),
    phrases: z
      .array(
        z
          .object({
            english: shortText,
            korean: shortText,
          })
          .strict(),
      )
      .min(3)
      .max(12),
    hints: z
      .array(
        z
          .object({
            intent: shortText,
            expression: shortText,
            example: paragraph,
          })
          .strict(),
      )
      .min(2)
      .max(10),
    rubric: z
      .object({
        taskCompletion: z.number().int().min(0).max(100),
        appropriateness: z.number().int().min(0).max(100),
        grammar: z.number().int().min(0).max(100),
        vocabulary: z.number().int().min(0).max(100),
        passScore: z.number().int().min(1).max(100),
      })
      .strict(),
    minTurns: z.number().int().min(2).max(30),
    maxTurns: z.number().int().min(3).max(50),
    rewardImagePrompt: z.string().trim().min(10).max(1_200),
  })
  .strict()
  .refine((draft) => draft.maxTurns >= draft.minTurns, {
    message: "maxTurns must be greater than or equal to minTurns",
    path: ["maxTurns"],
  });

export type CefrLevel = z.infer<typeof cefrLevelSchema>;
export type CharacterContext = z.infer<typeof characterContextSchema>;
export type MissionContext = z.infer<typeof missionContextSchema>;
export type ChatScenario = z.infer<typeof chatScenarioSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ImageKind = z.infer<typeof imageKindSchema>;
export type ImageRequest = z.infer<typeof imageRequestSchema>;
export type SpeechRequest = z.infer<typeof speechRequestSchema>;
export type MissionDraftScenario = z.infer<typeof missionDraftScenarioSchema>;
export type MissionDraftRequest = z.infer<typeof missionDraftRequestSchema>;
export type MissionDraft = z.infer<typeof missionDraftSchema>;
