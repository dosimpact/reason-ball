import { NextRequest } from "next/server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const upstream = await fetch(
      `${process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2037"}/canvas/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await request.text(),
        signal: request.signal,
      },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json(
      { error: "분석 서버에 연결할 수 없습니다." },
      { status: 502 },
    );
  }
}
