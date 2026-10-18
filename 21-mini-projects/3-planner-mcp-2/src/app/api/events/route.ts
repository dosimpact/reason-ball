import { getStore } from "@/app/server/runtime";
import { assertAllowedRequest, httpError } from "@/app/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try {
    assertAllowedRequest(request);
  } catch (e) {
    return httpError(e);
  }
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let version = getStore().version();
      let ticks = 0;
      let closed = false;
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      send(`event: change\ndata: ${version}\n\n`);
      const interval = setInterval(() => {
        const next = getStore().version();
        if (next !== version) {
          version = next;
          send(`event: change\ndata: ${version}\n\n`);
        } else if (++ticks % 15 === 0) send(": heartbeat\n\n");
      }, 1000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        request.signal.removeEventListener("abort", cleanup);
        controller.close();
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
      if (request.signal.aborted) cleanup();
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
