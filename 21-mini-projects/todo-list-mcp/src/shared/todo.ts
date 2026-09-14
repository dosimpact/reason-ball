import { z } from "zod";
export const titleSchema = z.string().trim().min(1).max(200);
export const createSchema = z.object({ title: titleSchema }).strict();
export const patchSchema = z
  .object({ title: titleSchema.optional(), completed: z.boolean().optional() })
  .strict()
  .refine((p) => Object.keys(p).length > 0, "Provide title or completed");
export const todoSchema = z.object({
  id: z.string().uuid(),
  title: titleSchema,
  completed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const storeSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    todos: z.array(todoSchema),
  })
  .refine(
    (s) => new Set(s.todos.map((t) => t.id)).size === s.todos.length,
    "Duplicate IDs",
  );
export type Todo = z.infer<typeof todoSchema>;
export type TodoStore = z.infer<typeof storeSchema>;
export type TodoPatch = z.infer<typeof patchSchema>;
export type Change = {
  revision: number;
  type: "created" | "updated" | "deleted";
  todoId: string;
};
export class TodoError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}
