import { todoRuntime } from "@/server/runtime";
import { guard } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try {
    guard(request);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const unsubscribe = todoRuntime.events.subscribe((change) =>
        send("data: " + JSON.stringify(change) + "\n\n"),
      );
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), 15000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          /* Already canceled by the reader. */
        }
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
      send("event: ready\ndata: {}\n\n");
      if (request.signal.aborted) cleanup();
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
