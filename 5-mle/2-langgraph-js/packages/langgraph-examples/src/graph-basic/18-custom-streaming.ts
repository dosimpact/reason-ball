import { Annotation, END, getWriter, type LangGraphRunnableConfig, START, StateGraph } from "@langchain/langgraph";

export interface CustomStreamingEvent {
  node: "download" | "process" | "upload";
  phase?: string;
  progress?: number;
  msg?: string;
}

const CustomStreamingState = Annotation.Root({
  item_id: Annotation<string>(),
  result: Annotation<string>()
});

type CustomStreamingStateValue = typeof CustomStreamingState.State;

function emit(config: LangGraphRunnableConfig, event: CustomStreamingEvent) {
  getWriter(config)?.(event);
}

export function download(_state: CustomStreamingStateValue, config: LangGraphRunnableConfig) {
  for (let index = 1; index <= 3; index += 1) {
    emit(config, {
      node: "download",
      progress: index / 3,
      msg: `chunk ${index}/3`
    });
  }

  return {};
}

export function processItem(_state: CustomStreamingStateValue, config: LangGraphRunnableConfig) {
  emit(config, { node: "process", phase: "start" });
  emit(config, { node: "process", phase: "transform" });
  emit(config, { node: "process", phase: "validate" });

  return {};
}

export function upload(state: CustomStreamingStateValue, config: LangGraphRunnableConfig) {
  emit(config, { node: "upload", msg: "uploading..." });
  emit(config, { node: "upload", msg: "done" });

  return {
    result: `processed:${state.item_id || "unknown"}`
  };
}

export function buildGraph() {
  return new StateGraph(CustomStreamingState)
    .addNode("download", download)
    .addNode("process", processItem)
    .addNode("upload", upload)
    .addEdge(START, "download")
    .addEdge("download", "process")
    .addEdge("process", "upload")
    .addEdge("upload", END)
    .compile();
}

export const graph = buildGraph();
export const customStreamingGraph = graph;
