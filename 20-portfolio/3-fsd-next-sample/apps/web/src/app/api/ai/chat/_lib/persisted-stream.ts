import type { UIMessageChunk } from "ai";

// Keep the success marker behind the source stream's async onEnd persistence.
// A DB failure must not look like a successfully saved assistant response.
export function gatePersistedStream(source: ReadableStream<UIMessageChunk>) {
  const reader = source.getReader();
  let finish: UIMessageChunk | undefined;
  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) {
            if (finish) controller.enqueue(finish);
            controller.close();
            reader.releaseLock();
            return;
          }
          if (next.value.type === "finish") {
            finish = next.value;
            continue;
          }
          controller.enqueue(next.value);
          return;
        }
      } catch {
        controller.enqueue({ type: "error", errorText: "The response could not be saved. Reload the conversation before retrying." });
        controller.close();
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      reader.releaseLock();
    },
  });
}
