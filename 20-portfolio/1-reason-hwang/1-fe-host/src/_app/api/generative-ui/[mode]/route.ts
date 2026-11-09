import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!["dynamic", "fixed", "sec"].includes(mode)) return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      if (source.host !== request.headers.get("host") || source.protocol !== request.nextUrl.protocol) return Response.json({ detail: "Origin mismatch" }, { status: 403 });
    } catch { return Response.json({ detail: "Origin mismatch" }, { status: 403 }); }
  }
  try {
    const response = await fetch(new URL(`/api/generative-ui/${mode}`, process.env.GENERATIVE_UI_API_URL ?? process.env.SEC_CHAT_API_URL ?? "http://127.0.0.1:8000"), {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: await request.text(), signal: request.signal, cache: "no-store",
    });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch { return Response.json({ detail: "화면 생성 서버에 연결할 수 없습니다." }, { status: 502 }); }
}
