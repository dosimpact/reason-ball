import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createLlm, DEFAULT_MODEL } from "../../common/llm.js";
import { appendMetric, createMetricsRecord, type MetricsRecord } from "./metrics.js";
import { TOOLS } from "./tools.js";

const replaceValue = <T>(_left: T, right: T) => right;

export const SYSTEM_PROMPT =
  "You are a helpful AI assistant. Use tools when appropriate. Keep answers concise.";

export const ObservabilityState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  metrics: Annotation<MetricsRecord[]>({
    reducer: replaceValue,
    default: () => []
  }),
  totalCostUsd: Annotation<number>({
    reducer: replaceValue,
    default: () => 0
  })
});

export type ObservabilityStateValue = typeof ObservabilityState.State;
export type ObservabilityUpdate = typeof ObservabilityState.Update;
export type ObservabilityNode = (
  state: ObservabilityStateValue,
  config?: RunnableConfig
) => ObservabilityUpdate | Promise<ObservabilityUpdate>;

export function metricsUpdateForResponse(
  state: Pick<ObservabilityStateValue, "metrics">,
  response: BaseMessage,
  modelAlias = DEFAULT_MODEL
): ObservabilityUpdate {
  const record = createMetricsRecord(modelAlias, response);
  const aggregate = appendMetric(state.metrics ?? [], record);
  return {
    messages: [response],
    metrics: aggregate.metrics,
    totalCostUsd: aggregate.totalCostUsd
  };
}

export function createAgentNode(
  options: {
    llm?: BaseChatModel;
    tools?: StructuredToolInterface[];
    modelAlias?: string;
    systemPrompt?: string;
  } = {}
): ObservabilityNode {
  const llm = options.llm ?? createLlm();
  const tools = options.tools ?? TOOLS;
  const bound = tools.length > 0 && llm.bindTools ? llm.bindTools(tools) : llm;
  const modelAlias = options.modelAlias ?? DEFAULT_MODEL;
  const systemPrompt = options.systemPrompt ?? SYSTEM_PROMPT;

  return async (state, config) => {
    const response = (await bound.invoke([new SystemMessage(systemPrompt), ...state.messages], config)) as BaseMessage;
    return metricsUpdateForResponse(state, response, modelAlias);
  };
}

export function shouldContinue(state: Pick<ObservabilityStateValue, "messages">): "tools" | "__end__" {
  const lastMessage = state.messages.at(-1) as AIMessage | undefined;
  return lastMessage?.tool_calls?.length ? "tools" : "__end__";
}

export function buildGraph(
  options: {
    agentNode?: ObservabilityNode;
    tools?: StructuredToolInterface[];
  } = {}
) {
  const tools = options.tools ?? TOOLS;

  return new StateGraph(ObservabilityState)
    .addNode("agent", options.agentNode ?? createAgentNode({ tools }))
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      __end__: END
    })
    .addEdge("tools", "agent")
    .compile();
}

export const graph = buildGraph();
export const observabilityGraph = graph;
