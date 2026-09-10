import { z } from "zod";

export const creationStatusSchema = z.enum(["draft", "generating", "review", "published", "archived"]);
export const creationSchema = z.object({
  kind: z.enum(["character", "mission"]), id: z.string().min(1).max(200),
  title: z.string().min(1), summary: z.string(), status: creationStatusSchema,
}).strict();
export const creationsSchema = z.object({
  source: z.enum(["browser", "account"]), items: z.array(creationSchema),
}).strict().refine((data) => new Set(data.items.map((item) => `${item.kind}:${item.id}`)).size === data.items.length);
export type Creation = z.infer<typeof creationSchema>;
export const creationStatusLabels = { draft: "초안", generating: "생성 중", review: "검토 중", published: "게시됨", archived: "보관됨" } as const;

export function canEditCreation(creation: Creation) {
  return creation.status === "draft" || creation.status === "published";
}
