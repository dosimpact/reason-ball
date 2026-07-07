import { END, START, StateGraph } from "@langchain/langgraph";
import { appendStep, TextState } from "./shared.js";

type TextStateValue = typeof TextState.State;

function uppercase(state: TextStateValue) {
  return {
    text: (state.text || "no input").toUpperCase(),
    steps: appendStep(state, "uppercase")
  };
}

function exclaim(state: TextStateValue) {
  return {
    text: `${state.text}!`,
    steps: appendStep(state, "exclaim")
  };
}

export function buildGraph() {
  return new StateGraph(TextState)
    .addNode("uppercase", uppercase)
    .addNode("exclaim", exclaim)
    .addEdge(START, "uppercase")
    .addEdge("uppercase", "exclaim")
    .addEdge("exclaim", END)
    .compile();
}

export const graph = buildGraph();
export const simpleGraph = graph;
