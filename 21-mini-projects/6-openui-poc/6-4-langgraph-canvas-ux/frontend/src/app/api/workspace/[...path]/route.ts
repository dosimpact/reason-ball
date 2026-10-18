import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(req: NextRequest, context: { params: Promise<{path: string[]}> }) {
  const {path} = await context.params;
  if (!(path.length === 1 && ["run", "health"].includes(path[0])) && !(path.length === 2 && path[0] === "query" && /^[a-f0-9]{24}$/.test(path[1]))) return new Response("Not found", {status:404});
  try {
    const upstream = await fetch(`${process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2037"}/canvas/${path.join("/")}`, {
      method:req.method, headers:{"Content-Type":"application/json"}, body:req.method === "POST" ? await req.text() : undefined, signal:req.signal, cache:"no-store",
    });
    return new Response(upstream.body, {status:upstream.status, headers:{"Content-Type":upstream.headers.get("Content-Type") || "application/json", "Cache-Control":"no-store", "X-Accel-Buffering":"no"}});
  } catch { return Response.json({error:"Python 서버에 연결할 수 없습니다."}, {status:502}); }
}
export const POST = proxy;
export const GET = proxy;
