import type { UIMessageChunk } from "ai";

// Keep the success marker behind the source stream's async onEnd persistence.
// A DB failure must not look like a successfully saved assistant response.
export function gatePersistedStream(source: ReadableStream<UIMessageChunk>, onFailure?: () => void) {
  const reader = source.getReader();
  let finish: UIMessageChunk | undefined;
  let consumerCancelled = false;
  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      try {
        while (true) {
          const next = await reader.read();
          // cancel() settles a pending read before the source finishes onEnd.
          // The output controller is already closed; persistence owns its outcome.
          if (consumerCancelled) return;
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
        if (consumerCancelled) return;
        onFailure?.();
        controller.enqueue({ type: "error", errorText: "The response could not be saved. Reload the conversation before retrying." });
        controller.close();
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      consumerCancelled = true;
      try {
        await reader.cancel(reason);
      } catch (error) {
        onFailure?.();
        throw error;
      } finally {
        reader.releaseLock();
      }
    },
  });
}
