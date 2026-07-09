import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { appendStep } from "./shared.js";

const MAX_ITERATIONS = 3;

function replace<T>(_current: T, value: T): T {
  return value;
}

const ReflectionState = Annotation.Root({
  task: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  draft: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  critique: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  iterations: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  history: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  steps: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

type ReflectionStateValue = typeof ReflectionState.State;

function twoSentenceDraft(task: string, iteration: number, critique: string): string {
  const subject = task.trim() || "the requested topic";
  if (iteration === 0) {
    return `${subject} helps teams build reliable agent workflows. It keeps planning, tools, and review steps visible.`;
  }
  return `${subject} gives teams a structured way to coordinate agent steps, tool use, and review loops. ${critique.includes("specific") ? "Use it when repeatable control flow and inspectable state matter." : "It is practical when state, routing, and retries need to be explicit."}`;
}

function generate(state: ReflectionStateValue) {
  const draft = twoSentenceDraft(state.task, state.iterations, state.critique);
  return {
    draft,
    iterations: state.iterations + 1,
    history: [...state.history, draft],
    steps: appendStep(state, `generate:${state.iterations + 1}`)
  };
}

function critic(state: ReflectionStateValue) {
  const sentenceCount = state.draft.split(/[.!?]+/).filter((part) => part.trim()).length;
  const hasConcreteWords = /\b(state|routing|tool|review|workflow|control)\b/i.test(state.draft);
  const critique = sentenceCount === 2 && hasConcreteWords ? "GOOD" : "Add a specific workflow benefit in exactly two sentences.";
  return {
    critique,
    steps: appendStep(state, `critic:${critique === "GOOD" ? "good" : "revise"}`)
  };
}

function shouldContinue(state: ReflectionStateValue): "generate" | "__end__" {
  if (state.critique.toUpperCase().includes("GOOD") || state.iterations >= MAX_ITERATIONS) {
    return "__end__";
  }
  return "generate";
}

export function buildGraph() {
  return new StateGraph(ReflectionState)
    .addNode("generate", generate)
    .addNode("critic", critic)
    .addEdge(START, "generate")
    .addEdge("generate", "critic")
    .addConditionalEdges("critic", shouldContinue, {
      generate: "generate",
      __end__: END
    })
    .compile();
}

export const graph = buildGraph();
export const reflectionGraph = graph;
