import { buildChatGraph } from "./shared.js";

export function buildGraph() {
  return buildChatGraph("You are a concise streaming demo assistant. Reply in short sentences.");
}

export const graph = buildGraph();
export const streamingGraph = graph;
