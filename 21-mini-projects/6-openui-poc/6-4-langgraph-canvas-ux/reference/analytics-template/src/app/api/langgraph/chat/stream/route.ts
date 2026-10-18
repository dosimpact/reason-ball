export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGGRAPH_BACKEND_URL =
  process.env.LANGGRAPH_API_URL ||
  process.env.NEXT_PUBLIC_LANGGRAPH_BACKEND_URL ||
  "http://127.0.0.1:2930";

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(`${LANGGRAPH_BACKEND_URL}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      Accept: "text/event-stream",
    },
    body,
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") || "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
