import { ChatOpenAI } from "@langchain/openai";

export const MODEL_ALIASES: Record<string, string> = {
  default: process.env.OPENAI_MODEL_DEFAULT ?? "gpt-4o-mini",
  fast: process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini",
  normal: process.env.OPENAI_MODEL_NORMAL ?? "gpt-5-nano",
  smart: process.env.OPENAI_MODEL_SMART ?? "gpt-5-mini",
  reasoning: process.env.OPENAI_MODEL_REASONING ?? "o4-mini"
};

export const DEFAULT_MODEL = process.env.LANGGRAPH_MODEL ?? process.env.OPENAI_MODEL ?? "default";

export function resolveModel(modelAlias = DEFAULT_MODEL): string {
  return MODEL_ALIASES[modelAlias] ?? modelAlias;
}

export function createLlm(modelAlias = DEFAULT_MODEL): ChatOpenAI {
  return new ChatOpenAI({
    model: resolveModel(modelAlias)
  });
}
