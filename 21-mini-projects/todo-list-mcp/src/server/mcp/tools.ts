import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { titleSchema, errorMessage, TodoError } from "../../shared/todo";
import type { TodoService } from "../core/todo-service";

async function toolResult(work: () => Promise<object>) {
  try {
    const result = await work();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: { ...result },
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text:
            error instanceof TodoError || error instanceof z.ZodError
              ? errorMessage(error)
              : "Storage operation failed",
        },
      ],
    };
  }
}
export function registerTools(server: McpServer, service: TodoService) {
  server.registerTool(
    "create_todo",
    { description: "Create a todo", inputSchema: { title: titleSchema } },
    (input) => toolResult(() => service.create(input)),
  );
  server.registerTool(
    "get_todo_list",
    {
      description: "Read the latest todo list",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => toolResult(() => service.list()),
  );
  server.registerTool(
    "get_todo_by_id",
    {
      description: "Read a todo",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    ({ id }) => toolResult(() => service.get(id)),
  );
  server.registerTool(
    "update_todo",
    {
      description: "Update title or completed; at least one required",
      inputSchema: {
        id: z.string(),
        title: titleSchema.optional(),
        completed: z.boolean().optional(),
      },
    },
    ({ id, ...patch }) => toolResult(() => service.update(id, patch)),
  );
  server.registerTool(
    "delete_todo",
    {
      description: "Delete a todo",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    ({ id }) => toolResult(() => service.delete(id)),
  );
}
