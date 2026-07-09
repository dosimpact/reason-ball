import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
import { createLlm } from "../common/llm.js";

export const GENERATE = "generate";
export const REFLECT = "reflect";
export const MAX_MESSAGES = 6;

const ReflectionMessagesState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  })
});

export type ReflectionMessagesStateValue = typeof ReflectionMessagesState.State;
export type ReflectionMessagesUpdate = typeof ReflectionMessagesState.Update;
export type ReflectionNode = (
  state: ReflectionMessagesStateValue,
  config?: RunnableConfig
) => ReflectionMessagesUpdate | Promise<ReflectionMessagesUpdate>;

export const REFLECTION_SYSTEM_PROMPT =
  "You are a viral social media editor grading a post. " +
  "You can work in both English and Korean. " +
  "Detect the language of the user's original request and provide critique in that same language unless the user explicitly asks for another language. " +
  "Generate detailed critique and recommendations for the user's post, including length, virality, style, clarity, hook strength, specificity, and whether the wording sounds natural in the target language.";

export const GENERATION_SYSTEM_PROMPT =
  "You are a social media writing assistant tasked with writing excellent English and Korean posts. " +
  "Detect the language of the user's original request and write in that same language unless the user explicitly asks for another language. " +
  "Generate the best post possible for the user's request. If the user provides critique, respond with a revised version of your previous attempt. " +
  "Make the result sound natural, concise, and platform-appropriate in the target language.";

function contentToText(content: BaseMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if ("text" in part && typeof part.text === "string") {
        return part.text;
      }
      return JSON.stringify(part);
    })
    .join(" ");
}

export function createGenerationNode(): ReflectionNode {
  const llm = createLlm("fast");

  return async (state, config) => {
    const response = await llm.invoke([new SystemMessage(GENERATION_SYSTEM_PROMPT), ...state.messages], config);
    return { messages: [response] };
  };
}

export function createReflectionNode(): ReflectionNode {
  const llm = createLlm("fast");

  return async (state, config) => {
    const response = await llm.invoke([new SystemMessage(REFLECTION_SYSTEM_PROMPT), ...state.messages], config);
    return { messages: [new HumanMessage(contentToText(response.content))] };
  };
}

function shouldContinue(maxMessages: number) {
  return (state: ReflectionMessagesStateValue): typeof REFLECT | "__end__" =>
    state.messages.length > maxMessages ? "__end__" : REFLECT;
}

export function buildGraph(
  options: {
    generationNode?: ReflectionNode;
    reflectionNode?: ReflectionNode;
    maxMessages?: number;
  } = {}
) {
  const generationNode = options.generationNode ?? createGenerationNode();
  const reflectionNode = options.reflectionNode ?? createReflectionNode();
  const maxMessages = options.maxMessages ?? MAX_MESSAGES;

  return new StateGraph(ReflectionMessagesState)
    .addNode(GENERATE, generationNode)
    .addNode(REFLECT, reflectionNode)
    .addEdge(START, GENERATE)
    .addConditionalEdges(GENERATE, shouldContinue(maxMessages), {
      [REFLECT]: REFLECT,
      __end__: END
    })
    .addEdge(REFLECT, GENERATE)
    .compile();
}

export function buildDeterministicReflectionGraph(maxMessages = MAX_MESSAGES) {
  let generationCount = 0;
  let reflectionCount = 0;

  return buildGraph({
    maxMessages,
    generationNode: () => {
      generationCount += 1;
      return { messages: [new AIMessage(`draft-${generationCount}`)] };
    },
    reflectionNode: () => {
      reflectionCount += 1;
      return { messages: [new HumanMessage(`critique-${reflectionCount}`)] };
    }
  });
}

export const graph = buildGraph();
export const lectureReflectionGraph = graph;
