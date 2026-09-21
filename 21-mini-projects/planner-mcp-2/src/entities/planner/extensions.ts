import { z } from "zod";
import { compileCodeWeave } from "@/modules/codeweave/core";
const key = z.string().min(1).max(100);
export const diagramExtension = z
  .object({
    id: key,
    type: z.literal("react-flow-diagram"),
    title: z.string().trim().min(1).max(160),
    schemaVersion: z.literal(1),
    data: z
      .object({
        nodes: z
          .array(
            z
              .object({
                id: key,
                label: z.string().trim().min(1).max(160),
                position: z
                  .object({ x: z.number().finite(), y: z.number().finite() })
                  .strict(),
              })
              .strict(),
          )
          .max(100),
        edges: z
          .array(z.object({ id: key, source: key, target: key }).strict())
          .max(200),
      })
      .strict(),
  })
  .strict()
  .superRefine((extension, ctx) => {
    const nodes = new Set(extension.data.nodes.map((node) => node.id));
    if (nodes.size !== extension.data.nodes.length)
      ctx.addIssue({
        code: "custom",
        message: "다이어그램 노드 ID는 중복될 수 없습니다.",
      });
    if (
      new Set(extension.data.edges.map((edge) => edge.id)).size !==
      extension.data.edges.length
    )
      ctx.addIssue({
        code: "custom",
        message: "다이어그램 연결 ID는 중복될 수 없습니다.",
      });
    for (const edge of extension.data.edges)
      if (!nodes.has(edge.source) || !nodes.has(edge.target))
        ctx.addIssue({
          code: "custom",
          message: "연결 대상 노드가 존재하지 않습니다.",
        });
  });
export const codeWeaveExtension = z
  .object({
    id: key,
    type: z.literal("codeweave"),
    title: z.string().trim().min(1).max(160),
    schemaVersion: z.literal(1),
    data: z.object({ source: z.string().max(50000) }).strict(),
  })
  .strict()
  .superRefine((extension, ctx) => {
    if (extension.data.source.length > 50000) return;
    for (const diagnostic of compileCodeWeave(extension.data.source)
      .diagnostics)
      ctx.addIssue({
        code: "custom",
        path: ["data", "source"],
        message: `Line ${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`,
      });
  });
export type CodeWeaveExtension = z.infer<typeof codeWeaveExtension>;
export type DocumentExtension = DiagramExtension | CodeWeaveExtension;
export const extensionList = z
  .array(z.discriminatedUnion("type", [diagramExtension, codeWeaveExtension]))
  .max(10)
  .superRefine((extensions, ctx) => {
    if (
      new Set(extensions.map((extension) => extension.id)).size !==
      extensions.length
    )
      ctx.addIssue({
        code: "custom",
        message: "확장 ID는 중복될 수 없습니다.",
      });
  });
export type DiagramExtension = z.infer<typeof diagramExtension>;
