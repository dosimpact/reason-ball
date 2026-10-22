import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin) {
      let allowed = false;
      try { const url = new URL(origin); allowed = url.host === request.headers.get("host") && url.protocol === request.nextUrl.protocol; } catch { /* Reject malformed origins. */ }
      if (!allowed) return Response.json({ detail: "Origin mismatch" }, { status: 403 });
    }
  }
  const { path } = await context.params;
  if (!/^(companies|resolve|prepare|chat|threads\/[a-f0-9]{32})$/.test(path.join("/"))) return new Response(null, { status: 404 });
  const base = process.env.SEC_CHAT_API_URL ?? "http://127.0.0.1:8000";
  const url = new URL(`/api/sec-chat/${path.join("/")}`, base);
  url.search = request.nextUrl.search;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: { "Content-Type": "application/json", Accept: request.headers.get("accept") ?? "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
      signal: request.signal,
      cache: "no-store",
    });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
  } catch {
    return Response.json({ detail: "SEC 채팅 서버에 연결할 수 없습니다." }, { status: 502 });
  }
}
export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
