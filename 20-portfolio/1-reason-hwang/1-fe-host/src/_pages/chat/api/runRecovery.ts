import type { Client } from "@langchain/langgraph-sdk";

export const isRunActive = (status: string) => ["pending", "running"].includes(status);

/** Reopen persisted state, never replay the missed token stream. */
export async function readRunSnapshot(client: Client, threadId: string, signal: AbortSignal) {
  const runs = await client.runs.list(threadId, { limit: 1, signal });
  const run = runs[0];
  const snapshot = await client.threads.getState(threadId, undefined, { signal });
  return { snapshot, run, running: !!run && isRunActive(run.status) };
}

export function waitForSnapshot(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("AbortError", "AbortError")); return; }
    const onAbort = () => { clearTimeout(timer); reject(new DOMException("AbortError", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 1500);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
