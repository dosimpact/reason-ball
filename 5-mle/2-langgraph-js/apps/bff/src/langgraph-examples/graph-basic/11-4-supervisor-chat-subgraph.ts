import { AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";

const CMD_SUMMARIZE = "summarize";
const CMD_APPEND = "append_message";

function replace<T>(_current: T, value: T): T {
  return value;
}

const ParentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  stage: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  analysis: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  final: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  chatCommand: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  chatPayload: Annotation<string>({
    reducer: replace,
    default: () => ""
  })
});

const ChatState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  chatCommand: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  chatPayload: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  uiStepCount: Annotation<number>({
    reducer: replace,
    default: () => 0
  })
});

type ParentStateValue = typeof ParentState.State;
type ChatStateValue = typeof ChatState.State;

function compact(text: string, maxLength = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

function summarizeNode(state: ChatStateValue) {
  const uiStepCount = state.uiStepCount + 1;
  const summary = compact(state.chatPayload || "(empty payload)", 72);
  return {
    uiStepCount,
    messages: [
      new AIMessage({
        content: `[ui_sync #${uiStepCount} | summarize] ${summary}`,
        name: "ui_sync"
      })
    ]
  };
}

function appendNode(state: ChatStateValue) {
  const uiStepCount = state.uiStepCount + 1;
  return {
    uiStepCount,
    messages: [
      new AIMessage({
        content: `[ui_sync #${uiStepCount} | append] ${state.chatPayload || "(empty payload)"}`,
        name: "ui_sync"
      })
    ]
  };
}

function chatRoute(state: ChatStateValue): "summarize_node" | "append_node" {
  return state.chatCommand === CMD_SUMMARIZE ? "summarize_node" : "append_node";
}

export function buildChatSubgraph() {
  return new StateGraph(ChatState)
    .addNode("summarize_node", summarizeNode)
    .addNode("append_node", appendNode)
    .addConditionalEdges(START, chatRoute, {
      summarize_node: "summarize_node",
      append_node: "append_node"
    })
    .addEdge("summarize_node", END)
    .addEdge("append_node", END)
    .compile();
}

const chatGraph = buildChatSubgraph();

function intake(state: ParentStateValue) {
  const userText = [...state.messages].reverse().find((message) => message.type === "human")?.text || "(no user input)";
  return {
    stage: "intake_done",
    messages: [new AIMessage({ content: `[intake] Parsed request: ${compact(userText, 60)}`, name: "intake" })]
  };
}

function research() {
  const analysis = "Q4 sales were 12.4M, up 22.7% from Q3, with metro channels reaching 58% share.";
  return {
    stage: "research_done",
    analysis,
    chatCommand: CMD_SUMMARIZE,
    chatPayload: analysis,
    messages: [new AIMessage({ content: `[research] ${analysis}`, name: "research" })]
  };
}

function analyze(state: ParentStateValue) {
  const analysis = `Growth driver: metro channel expansion. Evidence: ${state.analysis}`;
  return {
    stage: "analyze_done",
    analysis,
    messages: [new AIMessage({ content: `[analyze] ${analysis}`, name: "analyze" })]
  };
}

function draft() {
  const notice = "A stakeholder-ready draft is being prepared.";
  return {
    stage: "draft_done",
    chatCommand: CMD_APPEND,
    chatPayload: notice,
    messages: [new AIMessage({ content: "[draft] Executive summary draft prepared.", name: "draft" })]
  };
}

function conclusion() {
  const final =
    "Q4 sales rose 22.7% to 12.4M, led by metro channel expansion. Next quarter should focus on regional expansion.";
  return {
    stage: "finalized",
    final,
    chatCommand: CMD_SUMMARIZE,
    chatPayload: final,
    messages: [new AIMessage({ content: `[conclusion] ${final}`, name: "conclusion" })]
  };
}

export function buildGraph() {
  return new StateGraph(ParentState)
    .addNode("A_intake", intake)
    .addNode("B_research", research)
    .addNode("chat_after_B", chatGraph)
    .addNode("C_analyze", analyze)
    .addNode("D_draft", draft)
    .addNode("chat_after_D", chatGraph)
    .addNode("conclusion", conclusion)
    .addNode("chat_final", chatGraph)
    .addEdge(START, "A_intake")
    .addEdge("A_intake", "B_research")
    .addEdge("B_research", "chat_after_B")
    .addEdge("chat_after_B", "C_analyze")
    .addEdge("C_analyze", "D_draft")
    .addEdge("D_draft", "chat_after_D")
    .addEdge("chat_after_D", "conclusion")
    .addEdge("conclusion", "chat_final")
    .addEdge("chat_final", END)
    .compile();
}

export const graph = buildGraph();
export const supervisorChatSubgraph = graph;
