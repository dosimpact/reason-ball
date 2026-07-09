import { Annotation, END, Send, START, StateGraph } from "@langchain/langgraph";
import { lookupInfo } from "../common/tools.js";

export type TopicResult = {
  topic: string;
  info: string;
};

const replaceValue = <T>(_left: T, right: T) => right;

export const MapReduceState = Annotation.Root({
  topics: Annotation<string[]>({
    reducer: replaceValue,
    default: () => []
  }),
  results: Annotation<TopicResult[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  answer: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  })
});

const WorkerInput = Annotation.Root({
  topic: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  })
});

function dispatch() {
  return {};
}

function fanout(state: typeof MapReduceState.State) {
  if (state.topics.length === 0) {
    return "aggregate";
  }
  return state.topics.map((topic) => new Send("worker", { topic }));
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "content" in value) {
    return String((value as { content: unknown }).content);
  }
  return String(value);
}

async function worker(payload: typeof WorkerInput.State) {
  const info = await lookupInfo.invoke({ topic: payload.topic });
  return {
    results: [
      {
        topic: payload.topic,
        info: stringifyToolResult(info)
      }
    ]
  };
}

function aggregate(state: typeof MapReduceState.State) {
  const lines = state.results.map((result) => `- ${result.topic}: ${result.info}`);
  return {
    answer: lines.join("\n")
  };
}

export function buildMapReduceGraph() {
  return new StateGraph(MapReduceState)
    .addNode("dispatch", dispatch)
    .addNode("worker", worker, { input: WorkerInput })
    .addNode("aggregate", aggregate)
    .addEdge(START, "dispatch")
    .addConditionalEdges("dispatch", fanout, ["worker", "aggregate"])
    .addEdge("worker", "aggregate")
    .addEdge("aggregate", END)
    .compile();
}

export const mapReduceGraph = buildMapReduceGraph();
export const graph = mapReduceGraph;
