import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  RemoveMessage,
  SystemMessage,
  isAIMessage,
  isHumanMessage
} from "@langchain/core/messages";
import {
  Annotation,
  END,
  START,
  StateGraph,
  messagesStateReducer,
  type LangGraphRunnableConfig,
  type Messages
} from "@langchain/langgraph";
import { createLlm } from "../common/llm.js";

export const SUMMARIZE_AFTER = 8;
export const KEEP_RECENT = 4;

const replace = <T>(_left: T, right: T): T => right;

export const LongContextState = Annotation.Root({
  messages: Annotation<BaseMessage[], Messages>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  summary: Annotation<string>({
    reducer: replace,
    default: () => ""
  })
});

export type LongContextStateValue = typeof LongContextState.State;
export type LongContextUpdate = typeof LongContextState.Update;
export type LongContextNode = (
  state: LongContextStateValue,
  config?: LangGraphRunnableConfig
) =>
  | LongContextUpdate
  | Partial<LongContextStateValue>
  | Promise<LongContextUpdate | Partial<LongContextStateValue>>;

export interface SummarizeInput {
  transcript: string;
  previousSummary: string;
  config?: LangGraphRunnableConfig;
}

export type ConversationSummarizer = (input: SummarizeInput) => string | Promise<string>;

export function baseSystemPrompt(summary: string): string {
  const prompt = "You are a friendly assistant. Reply concisely in the user's language.";
  if (!summary) {
    return prompt;
  }

  return [
    prompt,
    "",
    "Summary of earlier conversation (for your context, do not repeat verbatim):",
    summary
  ].join("\n");
}

export function messageRole(message: BaseMessage): string {
  if (isHumanMessage(message)) {
    return "User";
  }

  if (isAIMessage(message)) {
    return "Assistant";
  }

  return message.type;
}

export function transcriptFor(messages: BaseMessage[]): string {
  return messages.map((message) => `${messageRole(message)}: ${message.text}`).join("\n");
}

export function needsSummaryFor(limit: number) {
  return (state: LongContextStateValue): "summarize" | "__end__" =>
    state.messages.length > limit ? "summarize" : "__end__";
}

export const needsSummary = needsSummaryFor(SUMMARIZE_AFTER);

export function createChatNode(): LongContextNode {
  return async (state, config) => {
    const llm = createLlm();
    const response = await llm.invoke(
      [new SystemMessage(baseSystemPrompt(state.summary)), ...state.messages],
      config
    );

    return { messages: [response] };
  };
}

export function createLlmSummarizer(): ConversationSummarizer {
  return async ({ transcript, previousSummary, config }) => {
    const instruction = [
      "Summarize the following conversation into 3-6 short bullet points preserving key facts.",
      "For Korean conversation, write the summary in Korean; otherwise write it in English.",
      previousSummary ? `\nPrevious summary to extend:\n${previousSummary}` : ""
    ].join("\n");

    const llm = createLlm();
    const response = await llm.invoke(
      [new SystemMessage(instruction), new HumanMessage(transcript)],
      config
    );

    return response.text.trim();
  };
}

export function createSummarizeNode(
  options: {
    keepRecent?: number;
    summarizer?: ConversationSummarizer;
  } = {}
): LongContextNode {
  const keepRecent = options.keepRecent ?? KEEP_RECENT;
  const summarizer = options.summarizer ?? createLlmSummarizer();

  return async (state, config) => {
    const toSummarize = keepRecent > 0 ? state.messages.slice(0, -keepRecent) : state.messages;
    if (!toSummarize.length) {
      return {};
    }

    const newSummary = await summarizer({
      transcript: transcriptFor(toSummarize),
      previousSummary: state.summary,
      config
    });

    const removals = toSummarize
      .filter((message) => message.id)
      .map((message) => new RemoveMessage({ id: message.id as string }));

    return {
      summary: newSummary.trim(),
      messages: removals
    };
  };
}

export function createDeterministicChatNode(reply = "ack"): LongContextNode {
  return (state) => ({
    messages: [new AIMessage(`${reply}: ${state.messages.at(-1)?.text ?? ""}`)]
  });
}

export function createDeterministicSummarizer(prefix = "Summary"): ConversationSummarizer {
  return ({ transcript, previousSummary }) =>
    [previousSummary, `${prefix}: ${transcript.split("\n").slice(0, 3).join(" | ")}`]
      .filter(Boolean)
      .join("\n");
}

export function buildGraph(
  options: {
    chat?: LongContextNode;
    summarize?: LongContextNode;
    summarizeAfter?: number;
  } = {}
) {
  return new StateGraph(LongContextState)
    .addNode("chat", options.chat ?? createChatNode())
    .addNode("summarize", options.summarize ?? createSummarizeNode())
    .addEdge(START, "chat")
    .addConditionalEdges("chat", needsSummaryFor(options.summarizeAfter ?? SUMMARIZE_AFTER), {
      summarize: "summarize",
      __end__: END
    })
    .addEdge("summarize", END)
    .compile();
}

export const graph = buildGraph();
