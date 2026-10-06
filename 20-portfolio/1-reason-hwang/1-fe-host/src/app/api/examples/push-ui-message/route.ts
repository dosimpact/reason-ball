import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = (process.env.A2UI_LANGGRAPH_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const upstream = await fetch(`${origin}/examples/push-ui-message/stream`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: await request.text(), signal: request.signal,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-cache" },
    });
  } catch {
    return Response.json({ detail: "예제 서버에 연결할 수 없습니다." }, { status: 502 });
  }
}
