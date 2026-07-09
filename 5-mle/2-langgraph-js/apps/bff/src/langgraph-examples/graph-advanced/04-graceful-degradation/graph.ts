import { Annotation, END, Send, START, StateGraph, type RetryPolicy } from "@langchain/langgraph";
import {
  alwaysFailingSearch,
  cachedAnswer,
  flakySearch,
  PermanentError,
  secondarySearch,
  slowThenOkSearch,
  TransientError
} from "./flaky-tools.js";

export type TopicResult = {
  topic: string;
  info: string;
};

const replaceValue = <T>(_left: T, right: T) => right;

export const SimpleState = Annotation.Root({
  query: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  }),
  result: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  }),
  usedStrategy: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  }),
  error: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  })
});

export const PartialState = Annotation.Root({
  query: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  }),
  topics: Annotation<string[]>({
    reducer: replaceValue,
    default: () => []
  }),
  results: Annotation<TopicResult[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  summary: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  })
});

const PartialWorkerInput = Annotation.Root({
  query: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  }),
  topic: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  })
});

const topicTools = {
  topic_a: flakySearch,
  topic_b: alwaysFailingSearch,
  topic_c: slowThenOkSearch
} as const;

type TopicName = keyof typeof topicTools;

function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "content" in value) {
    return String((value as { content: unknown }).content);
  }
  return String(value);
}

async function retryNode(state: typeof SimpleState.State) {
  const out = await flakySearch.invoke({ query: state.query });
  return {
    result: stringifyToolResult(out),
    usedStrategy: "retry"
  };
}

const retryPolicy: RetryPolicy = {
  maxAttempts: 4,
  initialInterval: 0.001,
  backoffFactor: 2,
  maxInterval: 0.005,
  jitter: false,
  logWarning: false,
  retryOn: (error) => error instanceof TransientError
};

export function buildRetryGraph() {
  return new StateGraph(SimpleState)
    .addNode("search", retryNode, { retryPolicy })
    .addEdge(START, "search")
    .addEdge("search", END)
    .compile();
}

async function safeSearchNode(state: typeof SimpleState.State) {
  try {
    const out = await alwaysFailingSearch.invoke({ query: state.query });
    return {
      result: stringifyToolResult(out),
      usedStrategy: "try_except"
    };
  } catch (error) {
    if (error instanceof PermanentError) {
      return {
        result: `(search unavailable: ${error.name}: ${error.message})`,
        usedStrategy: "try_except",
        error: error.message
      };
    }
    throw error;
  }
}

export function buildTryExceptGraph() {
  return new StateGraph(SimpleState)
    .addNode("search", safeSearchNode)
    .addEdge(START, "search")
    .addEdge("search", END)
    .compile();
}

async function primary(state: typeof SimpleState.State) {
  try {
    const out = await alwaysFailingSearch.invoke({ query: state.query });
    return {
      result: stringifyToolResult(out),
      usedStrategy: "primary"
    };
  } catch (error) {
    if (error instanceof PermanentError) {
      return {
        error: `primary: ${error.message}`
      };
    }
    throw error;
  }
}

async function secondary(state: typeof SimpleState.State) {
  try {
    const out = await secondarySearch.invoke({ query: state.query });
    return {
      result: stringifyToolResult(out),
      usedStrategy: "secondary"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: [state.error, `secondary: ${message}`].filter(Boolean).join(" | ")
    };
  }
}

async function cached(state: typeof SimpleState.State) {
  const out = await cachedAnswer.invoke({ query: state.query });
  return {
    result: stringifyToolResult(out),
    usedStrategy: "cached"
  };
}

function routeAfterPrimary(state: typeof SimpleState.State) {
  return state.result ? "__end__" : "secondary";
}

function routeAfterSecondary(state: typeof SimpleState.State) {
  return state.result ? "__end__" : "cached";
}

export function buildFallbackGraph() {
  return new StateGraph(SimpleState)
    .addNode("primary", primary)
    .addNode("secondary", secondary)
    .addNode("cached", cached)
    .addEdge(START, "primary")
    .addConditionalEdges("primary", routeAfterPrimary, {
      secondary: "secondary",
      __end__: END
    })
    .addConditionalEdges("secondary", routeAfterSecondary, {
      cached: "cached",
      __end__: END
    })
    .addEdge("cached", END)
    .compile();
}

function dispatch() {
  return {};
}

function fanout(state: typeof PartialState.State) {
  const topics = state.topics.length > 0 ? state.topics : (Object.keys(topicTools) as TopicName[]);
  return topics.map((topic) => new Send("worker", { query: state.query, topic }));
}

async function worker(payload: typeof PartialWorkerInput.State) {
  const topic = payload.topic as TopicName;
  const selectedTool = topicTools[topic];

  if (!selectedTool) {
    return {
      results: [
        {
          topic: payload.topic,
          info: "(failed: UnknownTopic)"
        }
      ]
    };
  }

  try {
    const out = await selectedTool.invoke({ query: payload.query });
    return {
      results: [
        {
          topic,
          info: stringifyToolResult(out)
        }
      ]
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    return {
      results: [
        {
          topic,
          info: `(failed: ${name})`
        }
      ]
    };
  }
}

function reduce(state: typeof PartialState.State) {
  const succeeded = state.results.filter((result) => !result.info.startsWith("(failed"));
  const failed = state.results.filter((result) => result.info.startsWith("(failed"));
  const lines = state.results.map((result) => `- ${result.topic}: ${result.info}`);
  const summary = [
    `Partial response: ${succeeded.length}/${state.results.length} succeeded.`,
    ...lines,
    failed.length > 0 ? `Failed topics: ${failed.map((result) => result.topic).join(", ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary
  };
}

export function buildPartialGraph() {
  return new StateGraph(PartialState)
    .addNode("dispatch", dispatch)
    .addNode("worker", worker, { input: PartialWorkerInput })
    .addNode("reduce", reduce)
    .addEdge(START, "dispatch")
    .addConditionalEdges("dispatch", fanout, ["worker"])
    .addEdge("worker", "reduce")
    .addEdge("reduce", END)
    .compile();
}

export const graphRetry = buildRetryGraph();
export const graphTryExcept = buildTryExceptGraph();
export const graphFallback = buildFallbackGraph();
export const graphPartial = buildPartialGraph();

export const retry = graphRetry;
export const tryExcept = graphTryExcept;
export const fallback = graphFallback;
export const partial = graphPartial;

export const graph = fallback;

export const GRAPHS = {
  retry,
  "try/except": tryExcept,
  try_except: tryExcept,
  fallback,
  partial
} as const;
