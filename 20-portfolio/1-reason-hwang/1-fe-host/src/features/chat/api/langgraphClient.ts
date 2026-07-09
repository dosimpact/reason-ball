import { Client } from "@langchain/langgraph-sdk";

import type { LangGraphConfig } from "@/shared/config/langgraph";

export function createLangGraphClient(config: LangGraphConfig) {
  return new Client({
    apiUrl: resolveLangGraphApiUrl(config.apiUrl),
  });
}

function resolveLangGraphApiUrl(apiUrl: string) {
  if (apiUrl.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${apiUrl}`;
  }

  return apiUrl;
}
