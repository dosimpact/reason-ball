import { Client } from "@langchain/langgraph-sdk";

import type { LangGraphConfig } from "@/shared/config";

export function createLangGraphClient(config: LangGraphConfig) {
  return new Client({
    apiUrl: resolveLangGraphApiUrl(config.apiUrl),
    callerOptions: { fetch: cancellationAwareFetch },
  });
}

function resolveLangGraphApiUrl(apiUrl: string) {
  if (apiUrl.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${apiUrl}`;
  }

  return apiUrl;
}

/** SDK retry detection matches the message prefix; native abort messages vary by browser. */
export const cancellationAwareFetch: typeof fetch = async (input, init) => {
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  if (signal?.aborted) {
    if (signal.reason instanceof Error && signal.reason.name === "TimeoutError") throw signal.reason;
    throw new DOMException("AbortError", "AbortError");
  }
  try { return await fetch(input, init); }
  catch (error) {
    if (signal?.aborted && signal.reason instanceof Error && signal.reason.name === "TimeoutError") throw signal.reason;
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw new DOMException("AbortError", "AbortError");
    throw error;
  }
};
