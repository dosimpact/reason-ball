import { Client } from "@langchain/langgraph-sdk";

import type { LangGraphConfig } from "@/shared/config/langgraph";

export function createLangGraphClient(config: LangGraphConfig) {
  return new Client({
    apiUrl: config.apiUrl,
  });
}
