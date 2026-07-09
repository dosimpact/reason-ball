import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { createLlm } from "../common/llm.js";
import { appendStep } from "./shared.js";

const replace = <T>(_left: T, right: T): T => right;

export interface RagDocument {
  id: string;
  title: string;
  text: string;
}

export const DOCS: RagDocument[] = [
  {
    id: "doc-1",
    title: "LangGraph",
    text:
      "LangGraph is a library for building stateful, multi-actor applications with LLMs. " +
      "It extends LangChain with cyclic graph support."
  },
  {
    id: "doc-2",
    title: "AWS Bedrock",
    text:
      "Amazon Bedrock is a fully managed service that offers foundation models from leading AI companies " +
      "(Anthropic, Meta, Cohere, Mistral) via a single API."
  },
  {
    id: "doc-3",
    title: "FastAPI",
    text:
      "FastAPI is a modern Python web framework based on type hints, with built-in OpenAPI/Swagger " +
      "documentation and async support."
  },
  {
    id: "doc-4",
    title: "Guardrails",
    text:
      "Bedrock Guardrails apply content filtering, PII masking, and prompt-injection detection on inputs " +
      "and outputs of foundation models."
  }
];

export const NO_RELEVANT_DOCUMENTS = "(no relevant documents)";

export const RagState = Annotation.Root({
  question: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  docs: Annotation<RagDocument[]>({
    reducer: replace,
    default: () => []
  }),
  context: Annotation<string>({
    reducer: replace,
    default: () => ""
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

export type RagStateValue = typeof RagState.State;
export type RagUpdate = typeof RagState.Update;
export type RagNode = (state: RagStateValue, config?: RunnableConfig) => RagUpdate | Promise<RagUpdate>;

const STOPWORDS = new Set(["a", "an", "and", "are", "for", "is", "of", "the", "to", "what"]);

export function keywordTerms(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !STOPWORDS.has(term));
}

export function retrieveDocuments(question: string, docs: RagDocument[] = DOCS, topK = 3): RagDocument[] {
  const terms = keywordTerms(question);

  const scored = docs
    .map((doc) => {
      const body = `${doc.title} ${doc.text}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (body.includes(term) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));

  return scored.slice(0, topK).map((item) => item.doc);
}

export function formatContext(docs: RagDocument[]): string {
  if (!docs.length) {
    return NO_RELEVANT_DOCUMENTS;
  }

  return docs.map((doc) => `[${doc.id} | ${doc.title}]\n${doc.text}`).join("\n\n");
}

export function createRetrieveNode(docs: RagDocument[] = DOCS): RagNode {
  return (state) => ({
    docs: retrieveDocuments(state.question, docs),
    steps: appendStep(state, "retrieve")
  });
}

export const augment: RagNode = (state) => ({
  context: formatContext(state.docs),
  steps: appendStep(state, "augment")
});

export const generateDeterministicAnswer: RagNode = (state) => {
  if (!state.docs.length) {
    return {
      answer: `I do not have enough relevant context to answer. ${NO_RELEVANT_DOCUMENTS}`,
      steps: appendStep(state, "generate")
    };
  }

  const citations = state.docs.map((doc) => `[${doc.id}]`).join(", ");
  return {
    answer: `${citations} ${state.docs.map((doc) => doc.text).join(" ")}`,
    steps: appendStep(state, "generate")
  };
};

export function createGenerateNode(): RagNode {
  return async (state, config) => {
    if (!state.docs.length || state.context === NO_RELEVANT_DOCUMENTS) {
      return {
        answer: `I do not have enough relevant context to answer. ${NO_RELEVANT_DOCUMENTS}`,
        steps: appendStep(state, "generate")
      };
    }

    const llm = createLlm();
    const response = await llm.invoke(
      [
        new SystemMessage(
          [
            "Answer the user question using ONLY the provided context.",
            "If the context is insufficient, say so explicitly.",
            "Cite document ids you used in square brackets, e.g. [doc-1].",
            "",
            `Context:\n${state.context}`
          ].join("\n")
        ),
        new HumanMessage(state.question)
      ],
      config
    );

    return {
      answer: response.text,
      steps: appendStep(state, "generate")
    };
  };
}

export function buildGraph(options: { docs?: RagDocument[]; generateNode?: RagNode } = {}) {
  return new StateGraph(RagState)
    .addNode("retrieve", createRetrieveNode(options.docs))
    .addNode("augment", augment)
    .addNode("generate", options.generateNode ?? createGenerateNode())
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "augment")
    .addEdge("augment", "generate")
    .addEdge("generate", END)
    .compile();
}

export const graph = buildGraph();
