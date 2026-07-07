import { Annotation, END, type BaseStore, type LangGraphRunnableConfig, START, StateGraph } from "@langchain/langgraph";

const MemoryState = Annotation.Root({
  user_id: Annotation<string>(),
  fact: Annotation<string>(),
  recalled: Annotation<string[]>()
});

type MemoryStateValue = typeof MemoryState.State;

export interface LongTermMemoryGraphOptions {
  store?: BaseStore;
}

function namespaceFor(state: MemoryStateValue): string[] {
  return ["memories", state.user_id || "anonymous"];
}

function memoryKey(fact: string): string {
  return fact.slice(0, 64);
}

export async function remember(state: MemoryStateValue, config: LangGraphRunnableConfig) {
  const fact = state.fact?.trim();
  if (!fact || !config.store) {
    return {};
  }

  await config.store.put(namespaceFor(state), memoryKey(fact), { data: fact });
  return {};
}

export async function recall(state: MemoryStateValue, config: LangGraphRunnableConfig) {
  if (!config.store) {
    return { recalled: [] };
  }

  const items = await config.store.search(namespaceFor(state), { limit: 100 });
  return {
    recalled: items
      .map((item) => item.value.data)
      .filter((value): value is string => typeof value === "string")
  };
}

export function buildGraph(options: LongTermMemoryGraphOptions = {}) {
  return new StateGraph(MemoryState)
    .addNode("remember", remember)
    .addNode("recall", recall)
    .addEdge(START, "remember")
    .addEdge("remember", "recall")
    .addEdge("recall", END)
    .compile({
      store: options.store
    });
}

export const graph = buildGraph();
export const longTermMemoryGraph = graph;
