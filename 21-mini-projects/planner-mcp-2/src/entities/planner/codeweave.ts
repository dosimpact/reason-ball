import { z } from "zod";
export const codeWeaveQuery = z
  .object({
    line: z.number().int().positive().optional(),
    query: z.string().max(500).optional(),
  })
  .strict();
export const codeWeaveNodeEdit = z
  .object({
    expectedRevision: z.number().int().positive(),
    expectedSource: z.string().max(50000),
    nodeId: z.string().regex(/^line:[1-9]\d*$/),
    patch: z
      .object({
        text: z.string().max(50000).optional(),
        prefix: z.string().max(500).optional(),
        direction: z.enum(["->", "<-"]).optional(),
        change: z.enum(["added", "removed", "unchanged"]).optional(),
        inlineComment: z.string().max(50000).nullable().optional(),
        blockComment: z.string().max(50000).nullable().optional(),
      })
      .strict(),
  })
  .strict();
