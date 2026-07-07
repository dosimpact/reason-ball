import { buildChatGraph } from "./shared.js";

export function buildGraph() {
  return buildChatGraph("You are a friendly assistant. Reply concisely in the user's language.");
}

export const graph = buildGraph();
export const llmGraph = graph;
