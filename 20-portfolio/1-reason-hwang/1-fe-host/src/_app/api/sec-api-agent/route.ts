import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  let allowed = !origin;
  try { if (origin) { const url = new URL(origin); allowed = url.host === request.headers.get("host") && url.protocol === request.nextUrl.protocol; } } catch { /* Invalid origin. */ }
  if (!allowed) {
    return Response.json({ detail: "Origin mismatch" }, { status: 403 });
  }
  try {
    const response = await fetch(new URL("/api/sec-deep-agent/chat", process.env.SEC_CHAT_API_URL ?? "http://127.0.0.1:8000"), {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: await request.text(), signal: request.signal, cache: "no-store",
    });
    return new Response(response.body, { status: response.status, headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-cache", "X-Accel-Buffering": "no",
    } });
  } catch {
    return Response.json({ detail: "SEC 에이전트 서버에 연결할 수 없습니다." }, { status: 502 });
  }
}
