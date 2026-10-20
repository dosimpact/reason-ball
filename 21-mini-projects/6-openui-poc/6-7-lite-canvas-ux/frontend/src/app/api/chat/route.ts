import { z } from "zod";
import { backendFetch } from "@/server/backend";

export const runtime = "nodejs";
export const maxDuration = 300;
const input = z.object({
  threadId: z.string().uuid(), messageId: z.string().uuid(),
  message: z.string().trim().min(1).max(20000),
  quote: z.object({ reportId: z.string().uuid(), text: z.string().min(1).max(2000) }).nullable().optional(),
});

export async function POST(req: Request) {
  let body;
  try { body = input.parse(await req.json()); }
  catch { return Response.json({ error: "메시지 또는 인용 형식이 올바르지 않습니다." }, { status: 400 }); }
  try {
    const thread = await backendFetch("/threads", { method: "POST", body: JSON.stringify({ thread_id: body.threadId, if_exists: "do_nothing" }) });
    if (!thread.ok) throw new Error("thread creation failed");
    const stream = await backendFetch(`/threads/${body.threadId}/runs/stream`, {
      method: "POST", signal: req.signal,
      body: JSON.stringify({
        assistant_id: process.env.LANGGRAPH_ASSISTANT_ID || "agent",
        input: { messages: [{ role: "human", content: body.message, id: body.messageId }], quote: body.quote ?? null },
        stream_mode: ["custom"], stream_subgraphs: true, on_disconnect: "continue", multitask_strategy: "reject",
      }),
    });
    if (!stream.ok) return Response.json({ error: stream.status === 409 ? "이 대화의 응답이 진행 중입니다." : "에이전트 실행을 시작하지 못했습니다." }, { status: stream.status });
    return new Response(stream.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  } catch {
    return Response.json({ error: "에이전트 서버에 연결하지 못했습니다." }, { status: 502 });
  }
}
