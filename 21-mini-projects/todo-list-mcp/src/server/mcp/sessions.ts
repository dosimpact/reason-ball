import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { TodoService } from "../core/todo-service";
import { TodoEvents } from "../events/todo-events";
import { createMcpServer } from "./create-server";
export class McpSessions {
  private sessions = new Map<
    string,
    WebStandardStreamableHTTPServerTransport
  >();
  constructor(
    private service: TodoService,
    private events: TodoEvents,
  ) {}
  async handle(request: Request) {
    const id = request.headers.get("mcp-session-id");
    if (id) {
      const session = this.sessions.get(id);
      return session
        ? session.handleRequest(request)
        : Response.json({ error: "Session not found" }, { status: 404 });
    }
    if (request.method !== "POST")
      return Response.json({ error: "Initialize first" }, { status: 400 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!isInitializeRequest(body))
      return Response.json({ error: "Initialize first" }, { status: 400 });
    const { server, dispose } = createMcpServer(this.service, this.events);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        this.sessions.set(id, transport);
      },
      onsessionclosed: async (id) => {
        this.sessions.delete(id);
        dispose();
        await server.close();
      },
    });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, {
        parsedBody: body,
      });
      if (!transport.sessionId) {
        dispose();
        await server.close();
      }
      return response;
    } catch (error) {
      dispose();
      await server.close();
      if (transport.sessionId) this.sessions.delete(transport.sessionId);
      throw error;
    }
  }
}
