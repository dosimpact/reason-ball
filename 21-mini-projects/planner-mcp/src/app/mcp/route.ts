import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getStore } from "@/app/server/runtime";
import { createMcpServer } from "@/app/server/mcp";
import { assertLocal, httpError, requestJson } from "@/app/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertLocal(request);
    const body = await requestJson(request);
    const server = createMcpServer(await getStore());
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { parsedBody: body });
    } finally {
      await server.close();
    }
  } catch (e) {
    return httpError(e);
  }
}
export function GET() {
  return new Response("Stateless MCP: use POST", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
export const DELETE = GET;
