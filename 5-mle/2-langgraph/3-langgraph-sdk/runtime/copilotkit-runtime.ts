import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

const host = process.env.COPILOTKIT_RUNTIME_HOST ?? "0.0.0.0";
const port = Number(process.env.COPILOTKIT_RUNTIME_PORT ?? 2932);
const basePath = "/api/copilotkit";
const deploymentUrl = process.env.AGENTIC_CHAT_LANGGRAPH_URL ?? "http://localhost:2933";

const runtime = new CopilotRuntime({
  agents: {
    agentic_chat: new LangGraphAgent({
      deploymentUrl,
      graphId: "agentic_chat",
      langsmithApiKey: process.env.LANGSMITH_API_KEY,
    }),
  },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath,
  cors: true,
});

function requestUrl(request: IncomingMessage) {
  const proto = request.headers["x-forwarded-proto"] ?? "http";
  const hostHeader = request.headers.host ?? `${host}:${port}`;
  return `${proto}://${hostHeader}${request.url ?? "/"}`;
}

async function sendResponse(serverResponse: ServerResponse, response: Response) {
  serverResponse.statusCode = response.status;
  response.headers.forEach((value, key) => {
    serverResponse.setHeader(key, value);
  });

  if (!response.body) {
    serverResponse.end();
    return;
  }

  const body = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  body.pipe(serverResponse);
}

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  if (!request.url?.startsWith(basePath)) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const fetchRequest = new Request(requestUrl(request), {
    method: request.method,
    headers: request.headers as HeadersInit,
    body: hasBody ? (Readable.toWeb(request) as BodyInit) : undefined,
    duplex: hasBody ? "half" : undefined,
  } as RequestInit & { duplex?: "half" });

  const fetchResponse = await handler(fetchRequest);
  await sendResponse(response, fetchResponse);
}

createServer((request, response) => {
  handleRequest(request, response).catch((error: unknown) => {
    console.error(error);
    if (!response.headersSent) {
      response.statusCode = 500;
    }
    response.end("CopilotKit runtime error");
  });
}).listen(port, host, () => {
  console.log(
    `CopilotKit runtime listening at http://${host}:${port}${basePath} -> ${deploymentUrl}`,
  );
});
