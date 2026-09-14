import {
  type McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { TodoError } from "../../shared/todo";
import type { TodoService } from "../core/todo-service";
import type { TodoEvents } from "../events/todo-events";

async function readTodoResource(service: TodoService, uri: URL) {
  try {
    const data =
      uri.href === "todo://list"
        ? await service.list()
        : await service.get(decodeURIComponent(uri.pathname.slice(1)));
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data),
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      error instanceof TodoError && error.status === 404 ? -32002 : -32603,
      error instanceof TodoError ? error.message : "Storage read failed",
    );
  }
}
export function registerResources(
  server: McpServer,
  service: TodoService,
  events: TodoEvents,
) {
  const subscriptions = new Set<string>();
  const read = (uri: URL) => readTodoResource(service, uri);
  server.registerResource(
    "todo-list",
    "todo://list",
    { mimeType: "application/json", description: "Current todos" },
    read,
  );
  server.registerResource(
    "todo-item",
    new ResourceTemplate("todo://items/{id}", { list: undefined }),
    { mimeType: "application/json" },
    read,
  );
  server.server.setRequestHandler(
    SubscribeRequestSchema,
    async ({ params }) => {
      if (
        params.uri !== "todo://list" &&
        !/^todo:\/\/items\/[^/]+$/.test(params.uri)
      )
        throw new McpError(-32002, "Resource not found");
      await read(new URL(params.uri));
      subscriptions.add(params.uri);
      return {};
    },
  );
  server.server.setRequestHandler(
    UnsubscribeRequestSchema,
    async ({ params }) => {
      subscriptions.delete(params.uri);
      return {};
    },
  );
  const unsubscribe = events.subscribe((change) => {
    const uris = [
      "todo://list",
      ...(change.type === "created" ? [] : ["todo://items/" + change.todoId]),
    ];
    for (const uri of uris)
      if (subscriptions.has(uri))
        void server.server
          .sendResourceUpdated({ uri })
          .catch((error) => console.error("MCP notification failed", error));
  });
  return () => {
    unsubscribe();
    subscriptions.clear();
  };
}
