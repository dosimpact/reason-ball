import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
import { calculate, lookupInfo } from "../common/tools.js";
import { appendStep } from "./shared.js";

const WORKERS = ["researcher", "calculator", "writer"] as const;
const MAX_SUPERVISOR_ITERATIONS = 10;

function replace<T>(_current: T, value: T): T {
  return value;
}

const SupervisorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  next: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  iterations: Annotation<number>({
    reducer: replace,
    default: () => 0
  }),
  completed: Annotation<string[]>({
    reducer: replace,
    default: () => []
  }),
  steps: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

type SupervisorStateValue = typeof SupervisorState.State;
type WorkerName = (typeof WORKERS)[number];

function textOf(message: BaseMessage | undefined): string {
  if (!message) {
    return "";
  }
  return message.text || String(message.content ?? "");
}

function latestUserText(state: SupervisorStateValue): string {
  const message = [...state.messages].reverse().find((item) => item.type === "human");
  return textOf(message);
}

function needsCalculation(input: string): boolean {
  return /\d+\s*[+\-*/]\s*\d+/.test(input);
}

function needsResearch(input: string): boolean {
  const normalized = input.toLowerCase();
  return (
    /\b(what|explain|describe|tell me|about|define)\b/.test(normalized) ||
    ["langgraph", "bedrock", "fastapi"].some((topic) => normalized.includes(topic))
  );
}

function extractExpression(input: string): string {
  const match = input.match(/[0-9][0-9+\-*/.() ]*[0-9)]/);
  return match?.[0]?.trim() || "0";
}

function extractTopic(input: string): string {
  const normalized = input.toLowerCase();
  for (const topic of ["langgraph", "bedrock", "fastapi"]) {
    if (normalized.includes(topic)) {
      return topic;
    }
  }
  return input.replace(/[0-9+\-*/().]/g, " ").replace(/\s+/g, " ").trim() || "LangGraph";
}

function hasWorkerOutput(state: SupervisorStateValue, worker: WorkerName): boolean {
  return state.completed.includes(worker);
}

function chooseNextWorker(state: SupervisorStateValue): WorkerName | "FINISH" {
  const input = latestUserText(state);
  if (needsResearch(input) && !hasWorkerOutput(state, "researcher")) {
    return "researcher";
  }
  if (needsCalculation(input) && !hasWorkerOutput(state, "calculator")) {
    return "calculator";
  }
  if (!hasWorkerOutput(state, "writer")) {
    return "writer";
  }
  return "FINISH";
}

function supervisor(state: SupervisorStateValue) {
  const iterations = state.iterations + 1;
  const next = iterations > MAX_SUPERVISOR_ITERATIONS ? "FINISH" : chooseNextWorker(state);
  return {
    next,
    iterations,
    messages: [
      new AIMessage({
        content: `[supervisor -> ${next}] deterministic route`,
        name: "supervisor"
      })
    ],
    steps: appendStep(state, `supervisor:${next}`)
  };
}

async function researcher(state: SupervisorStateValue) {
  const topic = extractTopic(latestUserText(state));
  const result = await lookupInfo.invoke({ topic });
  return {
    completed: [...state.completed, "researcher"],
    messages: [
      new AIMessage({
        content: `[researcher] ${result}`,
        name: "researcher"
      })
    ],
    steps: appendStep(state, "researcher")
  };
}

async function calculator(state: SupervisorStateValue) {
  const expression = extractExpression(latestUserText(state));
  const result = await calculate.invoke({ expression });
  return {
    completed: [...state.completed, "calculator"],
    messages: [
      new AIMessage({
        content: `[calculator] ${expression} = ${result}`,
        name: "calculator"
      })
    ],
    steps: appendStep(state, "calculator")
  };
}

function writer(state: SupervisorStateValue) {
  const workerOutputs = state.messages
    .filter((message) => message.type === "ai" && message.name && WORKERS.includes(message.name as WorkerName))
    .map((message) => textOf(message));
  const fallback = latestUserText(state) || "No user request was provided.";
  return {
    completed: [...state.completed, "writer"],
    messages: [
      new AIMessage({
        content: `[writer] ${workerOutputs.length ? workerOutputs.join(" ") : fallback}`,
        name: "writer"
      })
    ],
    steps: appendStep(state, "writer")
  };
}

function route(state: SupervisorStateValue): WorkerName | "__end__" {
  return state.next === "FINISH" ? "__end__" : (state.next as WorkerName);
}

export function buildGraph() {
  const builder = new StateGraph(SupervisorState)
    .addNode("supervisor", supervisor)
    .addNode("researcher", researcher)
    .addNode("calculator", calculator)
    .addNode("writer", writer)
    .addEdge(START, "supervisor")
    .addConditionalEdges("supervisor", route, {
      researcher: "researcher",
      calculator: "calculator",
      writer: "writer",
      __end__: END
    });

  for (const worker of WORKERS) {
    builder.addEdge(worker, "supervisor");
  }

  return builder.compile();
}

export const graph = buildGraph();
export const supervisorGraph = graph;
export const sampleInput = {
  messages: [new HumanMessage("Explain LangGraph and calculate 12 * 7.")],
  next: "",
  iterations: 0,
  completed: []
};
