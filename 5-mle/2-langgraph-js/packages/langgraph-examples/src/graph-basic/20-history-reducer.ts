import { BaseMessage } from "@langchain/core/messages";
import {
  Annotation,
  END,
  START,
  StateGraph,
  messagesStateReducer,
  type LangGraphRunnableConfig,
  type Messages
} from "@langchain/langgraph";
import { createLlm } from "../common/llm.js";
import { TOOLS } from "../common/tools.js";
import { makeCallModel } from "../node/llm-node.js";
import { shouldContinue } from "../node/routing.js";
import { makeToolNode } from "../node/tool-node.js";

export type HistoryEvent =
  | {
      event: "start";
      node: string;
      ts: number;
      inKeys: string[];
    }
  | {
      event: "end";
      node: string;
      ts: number;
      elapsedMs: number;
      outKeys: string[];
    };

export const HistoryState = Annotation.Root({
  messages: Annotation<BaseMessage[], Messages>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  history: Annotation<HistoryEvent[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  })
});

export type HistoryStateValue = typeof HistoryState.State;
export type HistoryUpdate = typeof HistoryState.Update;
export type HistoryNode = (
  state: HistoryStateValue,
  config?: LangGraphRunnableConfig
) => HistoryUpdate | Partial<HistoryStateValue> | Promise<HistoryUpdate | Partial<HistoryStateValue>>;

function normalizeNodeOutput(output: unknown): Record<string, unknown> {
  if (output == null) {
    return {};
  }

  if (Array.isArray(output)) {
    return { messages: output };
  }

  if (typeof output === "object") {
    return { ...(output as Record<string, unknown>) };
  }

  return { result: output };
}

export function withHistory(name: string, node: HistoryNode): HistoryNode {
  return async (state, config) => {
    const startedAt = Date.now();
    const startEntry: HistoryEvent = {
      event: "start",
      node: name,
      ts: startedAt,
      inKeys: Object.keys(state)
        .filter((key) => key !== "history")
        .sort()
    };

    const rawOutput = await node(state, config);
    const output = normalizeNodeOutput(rawOutput);
    const existingHistory = Array.isArray(output.history) ? (output.history as HistoryEvent[]) : [];
    delete output.history;

    const finishedAt = Date.now();
    const endEntry: HistoryEvent = {
      event: "end",
      node: name,
      ts: finishedAt,
      elapsedMs: finishedAt - startedAt,
      outKeys: Object.keys(output).sort()
    };

    return {
      ...output,
      history: [startEntry, ...existingHistory, endEntry]
    } as HistoryUpdate;
  };
}

export const loggerNode: HistoryNode = () => ({});

export function createAgentNode(): HistoryNode {
  const llm = createLlm();
  return withHistory("agent", makeCallModel(llm, { tools: TOOLS }) as HistoryNode);
}

export function createToolsNode(): HistoryNode {
  const toolNode = makeToolNode(TOOLS);
  return withHistory("tools", async (state, config) => toolNode.invoke(state, config));
}

export function buildGraph(
  options: {
    logger?: HistoryNode;
    agent?: HistoryNode;
    tools?: HistoryNode;
  } = {}
) {
  return new StateGraph(HistoryState)
    .addNode("logger", withHistory("logger", options.logger ?? loggerNode))
    .addNode("agent", options.agent ?? createAgentNode())
    .addNode("tools", options.tools ?? createToolsNode())
    .addEdge(START, "logger")
    .addEdge("logger", "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      __end__: END
    })
    .addEdge("tools", "agent")
    .compile();
}

export const graph = buildGraph();
