import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { appendStep } from "./shared.js";

const MAX_ATTEMPTS = 3;

function replace<T>(_current: T, value: T): T {
  return value;
}

const EvaluatorState = Annotation.Root({
  question: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  answer: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  verdict: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  score: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  feedback: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  attempts: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  drafts: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  steps: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

type EvaluatorStateValue = typeof EvaluatorState.State;

function generate(state: EvaluatorStateValue) {
  const attempts = state.attempts + 1;
  const question = state.question.trim() || "Explain LangGraph from a practical perspective.";
  const answer =
    attempts === 1
      ? `LangGraph helps build agent workflows for: ${question}`
      : `LangGraph is useful for ${question} because it models work as explicit state, nodes, edges, conditional routing, retries, and review loops. This makes production agent behavior easier to test, resume, and debug.`;
  return {
    answer,
    attempts,
    drafts: [...state.drafts, answer],
    steps: appendStep(state, `generate:${attempts}`)
  };
}

function evaluate(state: EvaluatorStateValue) {
  const required = ["state", "nodes", "edges", "routing"];
  const answer = state.answer.toLowerCase();
  const matched = required.filter((term) => answer.includes(term));
  const score = Math.min(5, Math.max(1, matched.length + (state.answer.length > 100 ? 1 : 0)));
  const verdict = score >= 4 ? "PASS" : "FAIL";
  const feedback = verdict === "PASS" ? "Meets concrete workflow criteria." : "Add state, nodes, edges, routing, and operational details.";
  return {
    verdict,
    score,
    feedback,
    steps: appendStep(state, `evaluate:${verdict}`)
  };
}

function routeAfterEval(state: EvaluatorStateValue): "generate" | "__end__" {
  if (state.verdict === "PASS" || state.attempts >= MAX_ATTEMPTS) {
    return "__end__";
  }
  return "generate";
}

export function buildGraph() {
  return new StateGraph(EvaluatorState)
    .addNode("generate", generate)
    .addNode("evaluate", evaluate)
    .addEdge(START, "generate")
    .addEdge("generate", "evaluate")
    .addConditionalEdges("evaluate", routeAfterEval, {
      generate: "generate",
      __end__: END
    })
    .compile();
}

export const graph = buildGraph();
export const evaluatorLoopGraph = graph;
