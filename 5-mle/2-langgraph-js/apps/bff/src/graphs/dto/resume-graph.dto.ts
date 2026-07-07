import type { RunnableConfig } from "@langchain/core/runnables";

export interface ResumeGraphDto {
  resume: unknown;
  config: RunnableConfig;
}
