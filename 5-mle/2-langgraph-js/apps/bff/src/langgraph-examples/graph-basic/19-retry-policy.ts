import { Annotation, END, START, StateGraph, type RetryPolicy } from "@langchain/langgraph";
import { appendStep } from "./shared.js";

const replaceValue = <T>(_left: T, right: T) => right;

export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientError";
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

export const RetryPolicyState = Annotation.Root({
  target: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  }),
  attempts: Annotation<number>({
    reducer: replaceValue,
    default: () => 0
  }),
  result: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  }),
  steps: Annotation<string[]>({
    reducer: replaceValue,
    default: () => []
  })
});

const attemptCounter = {
  count: 0
};

const failFirstN = 2;

export function resetAttemptCounter() {
  attemptCounter.count = 0;
}

export function getAttemptCount() {
  return attemptCounter.count;
}

function flakyCall(state: typeof RetryPolicyState.State) {
  attemptCounter.count += 1;
  const attempt = attemptCounter.count;

  if (state.target === "always_fail") {
    throw new PermanentError("This will never succeed");
  }

  if (attempt <= failFirstN) {
    throw new TransientError(`transient failure (attempt #${attempt})`);
  }

  return {
    attempts: attempt,
    result: `OK on attempt #${attempt}`,
    steps: appendStep(state, `flaky_call:${attempt}`)
  };
}

function finalize(state: typeof RetryPolicyState.State) {
  return {
    result: state.result || "(no result)",
    steps: appendStep(state, "finalize")
  };
}

const retryPolicy: RetryPolicy = {
  maxAttempts: 4,
  initialInterval: 1,
  backoffFactor: 2,
  maxInterval: 5,
  jitter: false,
  logWarning: false,
  retryOn: (error) => error instanceof TransientError
};

export function buildRetryPolicyGraph() {
  return new StateGraph(RetryPolicyState)
    .addNode("flaky_call", flakyCall, { retryPolicy })
    .addNode("finalize", finalize)
    .addEdge(START, "flaky_call")
    .addEdge("flaky_call", "finalize")
    .addEdge("finalize", END)
    .compile();
}

export const retryPolicyGraph = buildRetryPolicyGraph();
export const graph = retryPolicyGraph;
