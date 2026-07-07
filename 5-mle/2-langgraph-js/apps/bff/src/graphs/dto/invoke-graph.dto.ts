import type { RunnableConfig } from "@langchain/core/runnables";

export interface InvokeGraphDto {
  input: unknown;
  config?: RunnableConfig;
}
