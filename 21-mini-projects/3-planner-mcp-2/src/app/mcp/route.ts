import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/app/server/mcp";
import { getStore } from "@/app/server/runtime";
import {
  assertAllowedRequest,
  httpError,
  requestJson,
} from "@/app/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertAllowedRequest(request);
    const parsedBody = await requestJson(request);
    const server = createMcpServer(getStore());
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { parsedBody });
    } finally {
      await server.close();
    }
  } catch (error) {
    return httpError(error);
  }
}
export function GET() {
  return new Response("Use POST for stateless MCP", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
export const DELETE = GET;
