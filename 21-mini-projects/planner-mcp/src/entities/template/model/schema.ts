import { z } from "zod";

export const templateName = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "이름은 소문자 영문·숫자·하이픈으로 입력하세요.",
  )
  .max(80);
export const templateDraftSchema = z
  .object({
    name: templateName,
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000),
    format: z.enum(["markdown"]),
    body: z
      .string()
      .min(1)
      .max(200_000)
      .refine((v) => !!v.trim(), "템플릿 본문이 필요합니다."),
    example: z
      .string()
      .min(1)
      .max(200_000)
      .refine((v) => !!v.trim(), "예시 본문이 필요합니다."),
    prompt: z.string().trim().min(1).max(50_000),
  })
  .strict();
export const templateSchema = templateDraftSchema.extend({
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deleted: z.boolean().default(false),
});
export type TemplateDraft = z.infer<typeof templateDraftSchema>;
export type DocumentTemplate = z.infer<typeof templateSchema>;
