import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoService } from "../core/todo-service";
import type { TodoEvents } from "../events/todo-events";
import { registerTools } from "./tools";
import { registerResources } from "./resources";
import { registerPrompts } from "./prompts";
export function createMcpServer(service: TodoService, events: TodoEvents) {
  const server = new McpServer(
    { name: "todo-list-mcp", version: "1.0.0" },
    { capabilities: { resources: { subscribe: true } } },
  );
  registerTools(server, service);
  registerPrompts(server, service);
  const dispose = registerResources(server, service, events);
  return { server, dispose };
}
