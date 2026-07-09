import { type NextRequest } from "next/server";

const bffBaseUrl = (process.env.REMOTE_BFF_URL ?? "http://localhost:2801").replace(
  /\/+$/,
  "",
);

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToBff(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyToBff(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToBff(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToBff(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToBff(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToBff(request, context);
}

async function proxyToBff(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const targetUrl = new URL(`/${path.join("/")}`, bffBaseUrl);
  targetUrl.search = request.nextUrl.search;

  const proxyResponse = await fetch(targetUrl, {
    method: request.method,
    headers: getProxyRequestHeaders(request),
    body: hasRequestBody(request.method) ? request.body : undefined,
    duplex: "half",
    redirect: "manual",
  } as RequestInit & { duplex: "half" });

  return new Response(proxyResponse.body, {
    status: proxyResponse.status,
    statusText: proxyResponse.statusText,
    headers: getProxyResponseHeaders(proxyResponse),
  });
}

function hasRequestBody(method: string) {
  return method !== "GET" && method !== "HEAD";
}

function getProxyRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  for (const header of hopByHopHeaders) {
    headers.delete(header);
  }

  headers.set("host", new URL(bffBaseUrl).host);

  return headers;
}

function getProxyResponseHeaders(response: Response) {
  const headers = new Headers(response.headers);

  for (const header of hopByHopHeaders) {
    headers.delete(header);
  }

  return headers;
}
