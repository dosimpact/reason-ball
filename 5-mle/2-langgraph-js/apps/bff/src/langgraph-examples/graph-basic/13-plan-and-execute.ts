import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { appendStep } from "./shared.js";

type CompletedStep = {
  step: string;
  result: string;
};

function replace<T>(_current: T, value: T): T {
  return value;
}

const PlanExecuteState = Annotation.Root({
  task: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  plan: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  completed: Annotation<CompletedStep[]>({
    reducer: replace,
    default: () => []
  }),
  answer: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  steps: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

type PlanExecuteStateValue = typeof PlanExecuteState.State;

function planner(state: PlanExecuteStateValue) {
  const task = state.task.trim() || "Complete the requested work";
  const plan = [
    `Clarify outcome for: ${task}`,
    "Collect the minimum needed context",
    "Execute the main work",
    "Review the result and prepare the handoff"
  ];
  return {
    plan,
    completed: [],
    steps: appendStep(state, "planner")
  };
}

function executor(state: PlanExecuteStateValue) {
  const [step, ...remaining] = state.plan;
  if (!step) {
    return {};
  }
  const result = `Completed ${step.toLowerCase()}.`;
  return {
    plan: remaining,
    completed: [...state.completed, { step, result }],
    steps: appendStep(state, "executor")
  };
}

function hasMoreSteps(state: PlanExecuteStateValue): "executor" | "finalize" {
  return state.plan.length ? "executor" : "finalize";
}

function finalize(state: PlanExecuteStateValue) {
  const lines = state.completed.map((item, index) => `${index + 1}. ${item.step}\n   -> ${item.result}`);
  return {
    answer: `Plan executed:\n${lines.join("\n")}`,
    steps: appendStep(state, "finalize")
  };
}

export function buildGraph() {
  return new StateGraph(PlanExecuteState)
    .addNode("planner", planner)
    .addNode("executor", executor)
    .addNode("finalize", finalize)
    .addEdge(START, "planner")
    .addEdge("planner", "executor")
    .addConditionalEdges("executor", hasMoreSteps, {
      executor: "executor",
      finalize: "finalize"
    })
    .addEdge("finalize", END)
    .compile();
}

export const graph = buildGraph();
export const planAndExecuteGraph = graph;
