import { getStore } from "@/app/server/runtime";
import type { Change } from "@/app/server/store";
import { assertLocal, httpError } from "@/app/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    assertLocal(request);
    const store = await getStore(),
      encoder = new TextEncoder();
    let dispose = () => {};
    const stream = new ReadableStream({
      start(controller) {
        let closed = false,
          sequence = 0;
        const send = (value: string) => {
          if (!closed) controller.enqueue(encoder.encode(value));
        };
        const listener = (event: Change) =>
          send(
            `id: ${++sequence}\nevent: change\ndata: ${JSON.stringify(event)}\n\n`,
          );
        store.events.on("change", listener);
        const heartbeat = setInterval(() => send(": heartbeat\n\n"), 15000);
        dispose = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          store.events.off("change", listener);
          request.signal.removeEventListener("abort", dispose);
          controller.close();
        };
        request.signal.addEventListener("abort", dispose, { once: true });
        send("event: ready\ndata: {}\n\n");
        if (request.signal.aborted) dispose();
      },
      cancel() {
        dispose();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return httpError(e);
  }
}
