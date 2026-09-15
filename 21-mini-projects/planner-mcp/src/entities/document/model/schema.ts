import { z } from "zod";

export const identifier = z
  .string()
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/,
    "영문·숫자·밑줄·하이픈 ID를 사용하세요.",
  );
export const text = z.string().trim().min(1).max(2000);
export const typeIds = [
  "upstream-api-spec",
  "bff-api-spec",
  "db-entity",
  "weblogging-spec",
  "figma-requirements",
  "flow-spec-overview",
  "flow-spec-detail",
] as const;
export const documentType = z.enum(typeIds);
export type DocumentType = z.infer<typeof documentType>;
const field = z
  .object({
    name: text,
    description: text,
    type: text.optional(),
    required: z.boolean().optional(),
  })
  .strict();
const operation = z
  .object({
    id: identifier,
    name: text,
    protocol: z.enum(["http", "graphql", "rpc"]),
    address: text,
    method: text.optional(),
    input: z.array(field),
    output: z.array(field),
    errors: z.array(field).default([]),
  })
  .strict();
export const apiSpec = z
  .object({
    schemaVersion: z.literal(1),
    specKind: z.enum(["existing", "change"]),
    operations: z.array(operation).min(1),
    baseDocumentId: identifier.optional(),
    baseRevision: z.number().int().positive().optional(),
    changeReason: text.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.specKind === "change" && !v.changeReason)
      ctx.addIssue({
        code: "custom",
        path: ["changeReason"],
        message: "변경 이유가 필요합니다.",
      });
    if (!!v.baseDocumentId !== !!v.baseRevision)
      ctx.addIssue({
        code: "custom",
        path: ["baseRevision"],
        message: "기준 문서 ID와 revision을 함께 지정하세요.",
      });
  });
export const dbSpec = z
  .object({
    schemaVersion: z.literal(1),
    mermaid: z
      .string()
      .min(1)
      .max(100_000)
      .refine(
        (v) => /^\s*erDiagram\b/.test(v),
        "erDiagram으로 시작해야 합니다.",
      ),
  })
  .strict();
export const loggingSpec = z
  .object({
    schemaVersion: z.literal(1),
    events: z
      .array(
        z
          .object({
            id: identifier,
            eventName: text,
            trigger: text,
            condition: text,
            fields: z.array(field).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const safeUrl = z
  .url()
  .refine((v) => /^https?:\/\//.test(v), "HTTP(S) URL이 필요합니다.");
export const figmaSpec = z
  .object({
    schemaVersion: z.literal(1),
    widgets: z
      .array(
        z
          .object({
            widgetId: identifier,
            name: text,
            responsibility: text,
            figmaRefs: z.array(
              z
                .object({
                  screenName: text,
                  url: safeUrl,
                  nodeId: text.optional(),
                })
                .strict(),
            ),
            surfaces: z.array(text),
            inputValidation: z.array(
              z.object({ input: text, rule: text }).strict(),
            ),
            funnel: z.array(
              z.object({ action: text, destination: text }).strict(),
            ),
            states: z
              .array(z.object({ name: text, description: text }).strict())
              .default([]),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const sourceSchema = z
  .object({
    id: identifier,
    kind: z.enum(["requirement", "figma", "reference"]),
    title: text,
    originalText: z.string().max(200_000),
    url: safeUrl.optional(),
    capturedAt: z.iso.datetime(),
  })
  .strict();
export const statementSchema = z
  .object({ id: identifier, text, sourceIds: z.array(identifier).default([]) })
  .strict();
export const questionSchema = statementSchema.extend({
  blocking: z.boolean().default(false),
  resolved: z.boolean().default(false),
  answer: z.string().max(5000).optional(),
});
export const draftSchema = z
  .object({
    type: documentType,
    title: text,
    scope: text,
    content: z.unknown(),
    sourceIds: z.array(identifier).default([]),
    facts: z.array(statementSchema).default([]),
    assumptions: z.array(statementSchema).default([]),
    openQuestions: z.array(questionSchema).default([]),
    overviewDocumentId: identifier.optional(),
    overviewRevision: z.number().int().positive().optional(),
    overviewNodeId: z.string().min(1).max(128).optional(),
  })
  .strict();
export const commentSchema = z
  .object({
    questionId: identifier.optional(),
    id: identifier,
    author: text,
    text: z.string().trim().min(1).max(5000),
    createdAt: z.iso.datetime(),
    revision: z.number().int().positive(),
  })
  .strict();
export const documentSchema = draftSchema.extend({
  id: identifier,
  projectId: identifier,
  revision: z.number().int().positive(),
  status: z.enum(["draft", "reviewed", "approved"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  comments: z.array(commentSchema),
  approval: z
    .object({
      by: text,
      at: z.iso.datetime(),
      revision: z.number().int().positive(),
    })
    .strict()
    .nullable(),
});
export const projectSchema = z
  .object({
    id: identifier,
    name: text,
    description: z.string().max(5000),
    sources: z.array(sourceSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type Draft = z.infer<typeof draftSchema>;
export type PlannerDocument = z.infer<typeof documentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type ApiSpec = z.infer<typeof apiSpec>;
export type LoggingSpec = z.infer<typeof loggingSpec>;
export type FigmaSpec = z.infer<typeof figmaSpec>;
