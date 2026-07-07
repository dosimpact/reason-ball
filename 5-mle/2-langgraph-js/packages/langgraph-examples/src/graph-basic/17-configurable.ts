import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import {
  Annotation,
  END,
  START,
  StateGraph,
  messagesStateReducer,
  type LangGraphRunnableConfig,
  type Messages
} from "@langchain/langgraph";
import { z } from "zod";
import { createLlm } from "../common/llm.js";

export const STYLE_HINTS = {
  concise: "Reply in one short sentence.",
  detailed: "Reply with a detailed explanation including examples.",
  playful: "Reply in a playful, witty tone with at most two sentences."
} as const;

export const ConfigurableContextSchema = z.object({
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  system_prompt: z.string().optional(),
  style: z.enum(["concise", "detailed", "playful"]).optional(),
  temperature: z.number().min(0).max(2).optional()
});

export type ConfigurableContext = z.infer<typeof ConfigurableContextSchema>;

export const ConfigurableState = Annotation.Root({
  messages: Annotation<BaseMessage[], Messages>({
    reducer: messagesStateReducer,
    default: () => []
  })
});

export type ConfigurableStateValue = typeof ConfigurableState.State;
export type ConfigurableUpdate = typeof ConfigurableState.Update;
export type ConfigurableRuntime = LangGraphRunnableConfig<Partial<ConfigurableContext>>;
export type ConfigurableChatNode = (
  state: ConfigurableStateValue,
  config: ConfigurableRuntime
) => ConfigurableUpdate | Promise<ConfigurableUpdate>;

export interface ResolvedConfigurableOptions {
  model: string;
  systemPrompt: string;
  style: keyof typeof STYLE_HINTS;
  temperature?: number;
}

export function resolveRuntimeOptions(config?: ConfigurableRuntime): ResolvedConfigurableOptions {
  const raw = {
    ...(config?.context ?? {}),
    ...(config?.configurable ?? {})
  } as Partial<ConfigurableContext>;

  const style = raw.style && raw.style in STYLE_HINTS ? raw.style : "concise";

  return {
    model: raw.model ?? "default",
    systemPrompt: raw.systemPrompt ?? raw.system_prompt ?? "You are a helpful assistant.",
    style,
    temperature: raw.temperature
  };
}

export function systemPromptFor(options: ResolvedConfigurableOptions): string {
  return `${options.systemPrompt}\n${STYLE_HINTS[options.style]}`;
}

export function createConfigurableChatNode(): ConfigurableChatNode {
  return async (state, config) => {
    const options = resolveRuntimeOptions(config);
    const llm = createLlm(options.model);
    const callOptions =
      typeof options.temperature === "number" ? { ...config, temperature: options.temperature } : config;

    const response = await llm.invoke(
      [new SystemMessage(systemPromptFor(options)), ...state.messages],
      callOptions
    );

    return { messages: [response] };
  };
}

export function buildGraph(options: { chatNode?: ConfigurableChatNode } = {}) {
  return new StateGraph(ConfigurableState, { context: ConfigurableContextSchema })
    .addNode("chat", options.chatNode ?? createConfigurableChatNode())
    .addEdge(START, "chat")
    .addEdge("chat", END)
    .compile();
}

export const graph = buildGraph();
