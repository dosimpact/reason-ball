import { buildReactGraph } from "./shared.js";

export function buildGraph() {
  return buildReactGraph({ interruptBeforeTools: true });
}

export const graph = buildGraph();
export const interruptGraph = graph;
