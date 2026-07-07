import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { createLlm } from "../common/llm.js";
import { appendStep } from "./shared.js";

const replace = <T>(_left: T, right: T): T => right;

export const SentimentSchema = z.object({
  label: z.enum(["positive", "negative", "neutral"]).describe("Sentiment label"),
  score: z.number().min(0).max(1).describe("Confidence score from 0.0 to 1.0"),
  rationale: z.string().describe("One sentence rationale")
});

export type Sentiment = z.infer<typeof SentimentSchema>;

export const StructuredOutputState = Annotation.Root({
  text: Annotation<string>({
    reducer: replace,
    default: () => ""
  }),
  sentiment: Annotation<Sentiment | undefined>({
    reducer: replace,
    default: () => undefined
  }),
  steps: Annotation<string[]>({
    reducer: replace,
    default: () => []
  })
});

export type StructuredOutputStateValue = typeof StructuredOutputState.State;
export type StructuredOutputUpdate = typeof StructuredOutputState.Update;
export type AnalyzeNode = (
  state: StructuredOutputStateValue,
  config?: RunnableConfig
) => StructuredOutputUpdate | Promise<StructuredOutputUpdate>;

const POSITIVE_TERMS = [
  "love",
  "great",
  "best",
  "excellent",
  "happy",
  "good",
  "좋",
  "최고",
  "사랑",
  "기뻐",
  "만족"
];

const NEGATIVE_TERMS = [
  "worst",
  "bad",
  "slow",
  "angry",
  "hate",
  "terrible",
  "느리",
  "불친절",
  "화",
  "싫",
  "나쁘"
];

export function classifySentimentHeuristic(text: string): Sentiment {
  const normalized = text.toLowerCase();
  const positives = POSITIVE_TERMS.filter((term) => normalized.includes(term)).length;
  const negatives = NEGATIVE_TERMS.filter((term) => normalized.includes(term)).length;

  if (positives > negatives) {
    return {
      label: "positive",
      score: Math.min(0.95, 0.65 + positives * 0.1),
      rationale: "The text contains more positive sentiment cues than negative ones."
    };
  }

  if (negatives > positives) {
    return {
      label: "negative",
      score: Math.min(0.95, 0.65 + negatives * 0.1),
      rationale: "The text contains more negative sentiment cues than positive ones."
    };
  }

  return {
    label: "neutral",
    score: 0.6,
    rationale: "The text does not contain a strong positive or negative signal."
  };
}

export function createHeuristicAnalyzeNode(): AnalyzeNode {
  return (state) => ({
    sentiment: classifySentimentHeuristic(state.text),
    steps: appendStep(state, "analyze")
  });
}

export function createStructuredAnalyzeNode(): AnalyzeNode {
  const structuredLlm = createLlm().withStructuredOutput<Sentiment>(SentimentSchema, {
    name: "sentiment"
  });

  return async (state, config) => {
    const result = await structuredLlm.invoke(
      [
        new SystemMessage("You classify the sentiment of a Korean or English text."),
        new HumanMessage(state.text)
      ],
      config
    );

    return {
      sentiment: SentimentSchema.parse(result),
      steps: appendStep(state, "analyze")
    };
  };
}

export function buildGraph(options: { analyzeNode?: AnalyzeNode } = {}) {
  return new StateGraph(StructuredOutputState)
    .addNode("analyze", options.analyzeNode ?? createStructuredAnalyzeNode())
    .addEdge(START, "analyze")
    .addEdge("analyze", END)
    .compile();
}

export const graph = buildGraph();
