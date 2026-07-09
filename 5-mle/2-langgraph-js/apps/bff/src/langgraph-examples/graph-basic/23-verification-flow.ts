import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { appendStep } from "./shared.js";

const MAX_REPAIRS = 2;
const REQUIRED_CITATION = "[source:langgraph]";

function replace<T>(_current: T, value: T): T {
  return value;
}

const VerificationState = Annotation.Root({
  question: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  answer: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  verified: Annotation<boolean>({
    reducer: replace,
    default: () => false
  }),
  verificationErrors: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  repairCount: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  steps: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

type VerificationStateValue = typeof VerificationState.State;

function draft(state: VerificationStateValue) {
  const question = state.question.trim() || "What is LangGraph?";
  return {
    answer: `LangGraph answers this need: ${question}. It is a graph framework for stateful agent workflows, useful when nodes, edges, cycles, checkpoints, and review steps should be explicit.`,
    steps: appendStep(state, "draft")
  };
}

function verify(state: VerificationStateValue) {
  const answer = state.answer;
  const verificationErrors: string[] = [];
  if (!answer.includes(REQUIRED_CITATION)) {
    verificationErrors.push(`missing required citation ${REQUIRED_CITATION}`);
  }
  if (answer.length < 120) {
    verificationErrors.push("answer is too short to be useful");
  }
  if (/\b(guaranteed|100%)\b/i.test(answer)) {
    verificationErrors.push("overconfident guarantee is not allowed");
  }
  return {
    verified: verificationErrors.length === 0,
    verificationErrors,
    steps: appendStep(state, verificationErrors.length ? "verify:fail" : "verify:pass")
  };
}

function repair(state: VerificationStateValue) {
  let answer = state.answer;
  if (!answer.includes("checkpoints")) {
    answer += " Checkpoints persist state so interrupted or long-running work can resume safely.";
  }
  if (!answer.includes(REQUIRED_CITATION)) {
    answer += ` ${REQUIRED_CITATION}`;
  }
  if (answer.length < 120) {
    answer += " Use it when production workflows need clear control flow, testable routing, and recoverable execution.";
  }
  return {
    answer,
    repairCount: state.repairCount + 1,
    steps: appendStep(state, "repair")
  };
}

function routeAfterVerify(state: VerificationStateValue): "repair" | "__end__" {
  if (state.verified || state.repairCount >= MAX_REPAIRS) {
    return "__end__";
  }
  return "repair";
}

export function buildGraph() {
  return new StateGraph(VerificationState)
    .addNode("draft", draft)
    .addNode("verify", verify)
    .addNode("repair", repair)
    .addEdge(START, "draft")
    .addEdge("draft", "verify")
    .addConditionalEdges("verify", routeAfterVerify, {
      repair: "repair",
      __end__: END
    })
    .addEdge("repair", "verify")
    .compile();
}

export const graph = buildGraph();
export const verificationFlowGraph = graph;
export { REQUIRED_CITATION };
