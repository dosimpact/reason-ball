import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { appendStep, retrieveDocs } from "./shared.js";

type QaDoc = {
  id: string;
  title: string;
  text: string;
};

const DOCS: QaDoc[] = [
  {
    id: "qa-1",
    title: "LangGraph",
    text: "LangGraph models agent workflows as stateful graphs with nodes, edges, cycles, and reducers."
  },
  {
    id: "qa-2",
    title: "Checkpoint",
    text: "Checkpointers persist graph state by thread_id so interrupted runs can resume."
  },
  {
    id: "qa-3",
    title: "HITL",
    text: "Human-in-the-loop flows pause execution for review, approval, editing, or rejection before continuing."
  }
];

function replace<T>(_current: T, value: T): T {
  return value;
}

const QaPipelineState = Annotation.Root({
  question: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  docs: Annotation<QaDoc[]>({
    reducer: replace,
    default: () => []
  }),
  answer: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  citationOk: Annotation<boolean>({
    reducer: replace,
    default: () => false
  }),
  qaStatus: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  steps: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

type QaPipelineStateValue = typeof QaPipelineState.State;

function retrieve(state: QaPipelineStateValue) {
  const question = state.question.toLowerCase();
  const rankedTexts = retrieveDocs(state.question, DOCS.map((doc) => `${doc.title}: ${doc.text}`));
  const docs = DOCS.filter((doc) => rankedTexts.some((text) => text.startsWith(`${doc.title}:`))).filter((doc) => {
    const haystack = `${doc.title} ${doc.text}`.toLowerCase();
    return question.split(/\W+/).filter(Boolean).some((token) => haystack.includes(token));
  });
  return {
    docs: docs.slice(0, 2),
    steps: appendStep(state, "retrieve")
  };
}

function answerNode(state: QaPipelineStateValue) {
  if (!state.docs.length) {
    return {
      answer: "(no answer)",
      qaStatus: "no_docs",
      steps: appendStep(state, "answer:no_docs")
    };
  }
  const citations = state.docs.map((doc) => `[${doc.id}]`).join(" ");
  const context = state.docs.map((doc) => doc.text).join(" ");
  return {
    answer: `${context} ${citations}`,
    qaStatus: "answered",
    steps: appendStep(state, "answer")
  };
}

function citeCheck(state: QaPipelineStateValue) {
  const allowed = state.docs.map((doc) => `[${doc.id}]`);
  return {
    citationOk: allowed.some((citation) => state.answer.includes(citation)),
    steps: appendStep(state, "cite_check")
  };
}

function fallback(state: QaPipelineStateValue) {
  const reason = state.docs.length ? "The answer lacks a required citation." : "No related document was found.";
  return {
    answer: `${reason} I will not answer outside the current knowledge base.`,
    qaStatus: "fallback",
    steps: appendStep(state, "fallback")
  };
}

function routeAfterCiteCheck(state: QaPipelineStateValue): "fallback" | "__end__" {
  return state.citationOk ? "__end__" : "fallback";
}

export function buildGraph() {
  return new StateGraph(QaPipelineState)
    .addNode("retrieve", retrieve)
    .addNode("answer_node", answerNode)
    .addNode("cite_check", citeCheck)
    .addNode("fallback", fallback)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "answer_node")
    .addEdge("answer_node", "cite_check")
    .addConditionalEdges("cite_check", routeAfterCiteCheck, {
      fallback: "fallback",
      __end__: END
    })
    .addEdge("fallback", END)
    .compile();
}

export const graph = buildGraph();
export const qaPipelineGraph = graph;
export { DOCS };
