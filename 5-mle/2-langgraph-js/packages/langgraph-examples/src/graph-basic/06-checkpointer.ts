import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { buildReactGraph } from "./shared.js";

export interface CheckpointerGraphOptions {
  checkpointer?: BaseCheckpointSaver | boolean;
}

export function buildGraph(options: CheckpointerGraphOptions = {}) {
  return buildReactGraph({
    checkpointer: options.checkpointer
  });
}

export function buildStandaloneGraph() {
  return buildGraph({ checkpointer: new MemorySaver() });
}

export const graph = buildGraph();
export const checkpointerGraph = graph;
