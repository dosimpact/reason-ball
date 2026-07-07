import { AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";

const MAX_ITERATIONS = 3;

function replace<T>(_current: T, value: T): T {
  return value;
}

const ReflectionMessagesState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
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
  })
});

type ReflectionMessagesStateValue = typeof ReflectionMessagesState.State;

function latestTask(state: ReflectionMessagesStateValue): string {
  return [...state.messages].reverse().find((message) => message.type === "human")?.text || "the requested topic";
}

function progress(step: string, iteration: number): AIMessage {
  return new AIMessage({
    content: `[progress] ${step} (${iteration})`,
    name: "progress"
  });
}

function buildDraft(task: string, iteration: number): string {
  if (iteration === 0) {
    return `${task} helps teams turn agent work into explicit graph steps. It supports state, routing, and review.`;
  }
  return `${task} gives teams controlled graph steps for planning, tools, state, and review. Use it when agent behavior must be inspectable and repeatable.`;
}

function generate(state: ReflectionMessagesStateValue) {
  const iterations = state.iterations;
  const draft = buildDraft(latestTask(state), iterations);
  return {
    draft,
    iterations: iterations + 1,
    messages: [progress(iterations === 0 ? "drafting" : "revising", iterations + 1)]
  };
}

function critic(state: ReflectionMessagesStateValue) {
  const hasConcreteWords = /\b(state|routing|review|graph|tool)\b/i.test(state.draft);
  const critique = hasConcreteWords ? "GOOD" : "Add concrete LangGraph workflow details.";
  return {
    critique,
    messages: [progress("reviewing", state.iterations)]
  };
}

function finalize(state: ReflectionMessagesStateValue) {
  return {
    messages: [
      new AIMessage({
        content: state.draft,
        name: "final"
      })
    ]
  };
}

function shouldContinue(state: ReflectionMessagesStateValue): "generate" | "finalize" {
  if (state.critique.toUpperCase().includes("GOOD") || state.iterations >= MAX_ITERATIONS) {
    return "finalize";
  }
  return "generate";
}

export function buildGraph() {
  return new StateGraph(ReflectionMessagesState)
    .addNode("generate", generate)
    .addNode("critic", critic)
    .addNode("finalize", finalize)
    .addEdge(START, "generate")
    .addEdge("generate", "critic")
    .addConditionalEdges("critic", shouldContinue, {
      generate: "generate",
      finalize: "finalize"
    })
    .addEdge("finalize", END)
    .compile();
}

export const graph = buildGraph();
export const reflectionStreamingGraph = graph;
