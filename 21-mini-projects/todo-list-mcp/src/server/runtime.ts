import "server-only";
import { resolve } from "node:path";
import { JsonRepository } from "./storage/json-repository";
import { TodoEvents } from "./events/todo-events";
import { TodoService } from "./core/todo-service";
import { McpSessions } from "./mcp/sessions";
function createRuntime() {
  const events = new TodoEvents();
  // Runtime-owned local data must not be bundled into the Next.js build.
  const service = new TodoService(
    new JsonRepository(
      resolve(
        /* turbopackIgnore: true */ process.env.TODO_DATA_FILE ??
          "data/todos.json",
      ),
    ),
    events,
  );
  return { events, service, sessions: new McpSessions(service, events) };
}
const scope = globalThis as typeof globalThis & {
  todoRuntime?: ReturnType<typeof createRuntime>;
};
export const todoRuntime = (scope.todoRuntime ??= createRuntime());
