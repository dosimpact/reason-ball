import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

type ArtifactKind = "summary" | "tags" | "sentiment";

export type AnalysisArtifact = {
  kind: ArtifactKind;
  value: string | string[];
};

const replaceValue = <T>(_left: T, right: T) => right;

export const ParallelBranchesState = Annotation.Root({
  text: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  }),
  artifacts: Annotation<AnalysisArtifact[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  report: Annotation<string>({
    reducer: replaceValue,
    default: () => ""
  })
});

const artifactOrder: Record<ArtifactKind, number> = {
  summary: 0,
  tags: 1,
  sentiment: 2
};

function summarize(state: typeof ParallelBranchesState.State) {
  const summary = state.text.length <= 60 ? state.text : `${state.text.slice(0, 57)}...`;
  return {
    artifacts: [{ kind: "summary" as const, value: summary }]
  };
}

function tagger(state: typeof ParallelBranchesState.State) {
  const tags = Array.from(
    new Set(
      state.text
        .split(/\s+/)
        .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase())
        .filter((word) => word.length >= 4)
    )
  )
    .sort()
    .slice(0, 5);

  return {
    artifacts: [{ kind: "tags" as const, value: tags }]
  };
}

function sentiment(state: typeof ParallelBranchesState.State) {
  const text = state.text.toLowerCase();
  const positiveWords = ["good", "great", "love", "amazing", "best", "happy", "좋"];
  const negativeWords = ["bad", "hate", "worst", "sad", "angry", "싫"];
  const positiveScore = positiveWords.filter((word) => text.includes(word)).length;
  const negativeScore = negativeWords.filter((word) => text.includes(word)).length;
  const score = positiveScore - negativeScore;
  const label = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";

  return {
    artifacts: [{ kind: "sentiment" as const, value: label }]
  };
}

function join(state: typeof ParallelBranchesState.State) {
  const lines = [...state.artifacts]
    .sort((a, b) => artifactOrder[a.kind] - artifactOrder[b.kind])
    .map((artifact) => `- ${artifact.kind}: ${Array.isArray(artifact.value) ? artifact.value.join(", ") : artifact.value}`);

  return {
    report: lines.join("\n")
  };
}

export function buildParallelBranchesGraph() {
  return new StateGraph(ParallelBranchesState)
    .addNode("summarize", summarize)
    .addNode("tagger", tagger)
    .addNode("sentiment", sentiment)
    .addNode("join", join)
    .addEdge(START, "summarize")
    .addEdge(START, "tagger")
    .addEdge(START, "sentiment")
    .addEdge(["summarize", "tagger", "sentiment"], "join")
    .addEdge("join", END)
    .compile();
}

export const parallelBranchesGraph = buildParallelBranchesGraph();
export const graph = parallelBranchesGraph;
