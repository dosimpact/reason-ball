import { Annotation, END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createLlm } from "../common/llm.js";
import { TOOLS } from "../common/tools.js";
import { makeCallModel } from "../node/llm-node.js";
import { shouldContinue } from "../node/routing.js";
import { makeToolNode } from "../node/tool-node.js";

export const TextState = Annotation.Root({
  text: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => ""
  }),
  steps: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => []
  })
});

export const DocumentsState = Annotation.Root({
  question: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => ""
  }),
  documents: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => []
  }),
  answer: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => ""
  }),
  steps: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => []
  })
});

export const WorkflowState = Annotation.Root({
  input: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => ""
  }),
  plan: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => []
  }),
  result: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => ""
  }),
  critique: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => ""
  }),
  approved: Annotation<boolean | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined
  }),
  attempts: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0
  }),
  steps: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => []
  })
});

export function appendStep(state: { steps?: string[] }, step: string): string[] {
  return [...(state.steps ?? []), step];
}

export function buildChatGraph(systemPrompt: string) {
  const llm = createLlm();
  const chatNode = makeCallModel(llm, { systemPrompt });

  return new StateGraph(MessagesAnnotation)
    .addNode("chat", chatNode)
    .addEdge(START, "chat")
    .addEdge("chat", END)
    .compile();
}

export function buildReactGraph(options: { interruptBeforeTools?: boolean; checkpointer?: any } = {}) {
  const llm = createLlm();
  const agentNode = makeCallModel(llm, { tools: TOOLS });
  const toolNode = makeToolNode(TOOLS);

  const builder = new StateGraph(MessagesAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      __end__: END
    })
    .addEdge("tools", "agent");

  return builder.compile(
    Object.fromEntries(
      Object.entries({
        checkpointer: options.checkpointer,
        interruptBefore: options.interruptBeforeTools ? ["tools"] : undefined
      }).filter(([, value]) => value !== undefined)
    ) as any
  );
}

export async function answerWithLlm(question: string, context: string, config?: RunnableConfig) {
  const llm = createLlm();
  const response = await llm.invoke(
    [
      new SystemMessage("Answer concisely in the user's language using the provided context when useful."),
      new HumanMessage(`Context:\n${context}\n\nQuestion:\n${question}`)
    ],
    config
  );
  return typeof response.content === "string" ? response.content : JSON.stringify(response.content);
}

export const DEMO_DOCS = [
  "LangGraph builds stateful graph workflows with nodes, edges, persistence, streaming, and human-in-the-loop support.",
  "NestJS is a TypeScript server framework that works well as a BFF around reusable domain packages.",
  "LangSmith traces LLM calls and graph runs for debugging, tests, and evaluation."
];

export function retrieveDocs(question: string, docs = DEMO_DOCS): string[] {
  const terms = question.toLowerCase().split(/\W+/).filter(Boolean);
  return docs
    .map((doc) => ({
      doc,
      score: terms.reduce((sum, term) => sum + (doc.toLowerCase().includes(term) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.doc);
}
