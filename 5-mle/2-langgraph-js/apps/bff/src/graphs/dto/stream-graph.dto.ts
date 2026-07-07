import type { RunnableConfig } from "@langchain/core/runnables";

export interface StreamGraphDto {
  input: unknown;
  config?: RunnableConfig;
  streamMode?: string | string[];
}
