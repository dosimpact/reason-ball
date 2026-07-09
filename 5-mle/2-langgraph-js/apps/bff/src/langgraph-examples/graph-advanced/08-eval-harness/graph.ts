import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { createLlm } from "../../common/llm.js";
import { makeCallModel } from "../../node/llm-node.js";
import { shouldContinue } from "../../node/routing.js";
import { makeToolNode } from "../../node/tool-node.js";
import { TOOLS } from "./tools.js";

export const SYSTEM_PROMPT =
  "You are a helpful assistant. Use the available tools when appropriate. Be concise and accurate.";

export type EvalMessagesState = typeof MessagesAnnotation.State;
export type EvalMessagesUpdate = typeof MessagesAnnotation.Update;
export type EvalAgentNode = (
  state: EvalMessagesState,
  config?: RunnableConfig
) => EvalMessagesUpdate | Promise<EvalMessagesUpdate>;

export function createAgentNode(
  options: {
    llm?: BaseChatModel;
    tools?: StructuredToolInterface[];
    systemPrompt?: string;
  } = {}
): EvalAgentNode {
  return makeCallModel(options.llm ?? createLlm(), {
    systemPrompt: options.systemPrompt ?? SYSTEM_PROMPT,
    tools: options.tools ?? TOOLS
  }) as EvalAgentNode;
}

export function buildGraph(
  options: {
    agentNode?: EvalAgentNode;
    tools?: StructuredToolInterface[];
  } = {}
) {
  const tools = options.tools ?? TOOLS;

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", options.agentNode ?? createAgentNode({ tools }))
    .addNode("tools", makeToolNode(tools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      __end__: END
    })
    .addEdge("tools", "agent")
    .compile();
}

export function buildDeterministicEvalGraph(response: BaseMessage) {
  return buildGraph({
    agentNode: () => ({ messages: [response] })
  });
}

export const graph = buildGraph();
export const evalHarnessGraph = graph;
