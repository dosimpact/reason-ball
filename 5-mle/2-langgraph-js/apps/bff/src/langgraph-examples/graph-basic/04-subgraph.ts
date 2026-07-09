import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import {
  Annotation,
  END,
  messagesStateReducer,
  START,
  StateGraph,
  type Messages
} from "@langchain/langgraph";
import { appendStep } from "./shared.js";

type Intent = "translate" | "summarize" | "other";
type Language = "ko" | "en";

const replaceValue = <T>(_left: T, right: T) => right;

export const SubgraphState = Annotation.Root({
  messages: Annotation<BaseMessage[], Messages>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  intent: Annotation<Intent>({
    reducer: replaceValue,
    default: () => "other"
  }),
  sourceLanguage: Annotation<Language | undefined>({
    reducer: replaceValue,
    default: () => undefined
  }),
  targetLanguage: Annotation<Language | undefined>({
    reducer: replaceValue,
    default: () => undefined
  }),
  steps: Annotation<string[]>({
    reducer: replaceValue,
    default: () => []
  })
});

function lastUserText(state: typeof SubgraphState.State): string {
  for (const message of [...state.messages].reverse()) {
    if (message.type === "human") {
      return message.text;
    }
  }
  return state.messages.at(-1)?.text ?? "";
}

function classifyIntent(text: string): { intent: Intent; rationale: string } {
  const normalized = text.toLowerCase();
  const isTranslate =
    /\btranslate\b|\btranslation\b|번역|한국어로|영어로|한글로|영문으로/.test(normalized);
  const isSummarize = /\bsummarize\b|\bsummary\b|요약|핵심|한 문장/.test(normalized);

  if (isTranslate) {
    return { intent: "translate", rationale: "translation keyword detected" };
  }
  if (isSummarize) {
    return { intent: "summarize", rationale: "summary keyword detected" };
  }
  return { intent: "other", rationale: "no translation or summary cue detected" };
}

function classify(state: typeof SubgraphState.State) {
  const result = classifyIntent(lastUserText(state));
  return {
    intent: result.intent,
    messages: [
      new AIMessage({
        content: `[classify] intent=${result.intent} - ${result.rationale}`,
        name: "classifier"
      })
    ],
    steps: appendStep(state, "classify")
  };
}

function routeByIntent(state: typeof SubgraphState.State): Intent {
  return state.intent;
}

function detectLanguage(text: string): Language {
  const hangulCount = (text.match(/[가-힣]/g) ?? []).length;
  const latinCount = (text.match(/[a-z]/gi) ?? []).length;
  return hangulCount > latinCount ? "ko" : "en";
}

function detectLang(state: typeof SubgraphState.State) {
  const sourceLanguage = detectLanguage(lastUserText(state));
  const targetLanguage: Language = sourceLanguage === "ko" ? "en" : "ko";

  return {
    sourceLanguage,
    targetLanguage,
    messages: [
      new AIMessage({
        content: `[detect_lang] src=${sourceLanguage}, tgt=${targetLanguage}`,
        name: "detect_lang"
      })
    ],
    steps: appendStep(state, "detect_lang")
  };
}

function deterministicTranslate(text: string, sourceLanguage: Language): string {
  const normalized = text.trim();
  if (sourceLanguage === "en") {
    if (/hello|how are you/i.test(normalized)) {
      return "안녕하세요, 오늘 어떻게 지내세요?";
    }
    return `한국어 번역: ${normalized}`;
  }

  const withoutPrompt = normalized.replace(/^.*?:\s*/, "");
  if (/오늘 회의는 오후 3시/.test(withoutPrompt)) {
    return "Today's meeting is at 3 PM.";
  }
  return `English translation: ${withoutPrompt}`;
}

function translate(state: typeof SubgraphState.State) {
  const sourceLanguage = state.sourceLanguage ?? detectLanguage(lastUserText(state));
  const targetLanguage = state.targetLanguage ?? (sourceLanguage === "ko" ? "en" : "ko");
  const translated = deterministicTranslate(lastUserText(state), sourceLanguage);

  return {
    messages: [
      new AIMessage({
        content: `[translate ${sourceLanguage}->${targetLanguage}] ${translated}`,
        name: "translator"
      })
    ],
    steps: appendStep(state, "translate")
  };
}

function summarizeText(text: string): string {
  const body = text.replace(/^.*?:\s*/, "").trim();
  if (body.length <= 80) {
    return body;
  }
  return `${body.slice(0, 77)}...`;
}

function summarize(state: typeof SubgraphState.State) {
  return {
    messages: [
      new AIMessage({
        content: `[summary] ${summarizeText(lastUserText(state))}`,
        name: "summarizer"
      })
    ],
    steps: appendStep(state, "summarize")
  };
}

function finalizeOther(state: typeof SubgraphState.State) {
  return {
    messages: [
      new AIMessage({
        content: "[other] This request is not a translation or summary task.",
        name: "finalize_other"
      })
    ],
    steps: appendStep(state, "finalize_other")
  };
}

function buildTranslatorSubgraph() {
  return new StateGraph(SubgraphState)
    .addNode("detect_lang", detectLang)
    .addNode("translate", translate)
    .addEdge(START, "detect_lang")
    .addEdge("detect_lang", "translate")
    .addEdge("translate", END)
    .compile();
}

function buildSummarizerSubgraph() {
  return new StateGraph(SubgraphState)
    .addNode("summarize", summarize)
    .addEdge(START, "summarize")
    .addEdge("summarize", END)
    .compile();
}

export const translatorSubgraph = buildTranslatorSubgraph();
export const summarizerSubgraph = buildSummarizerSubgraph();

async function runTranslatorSubgraph(state: typeof SubgraphState.State) {
  const messageCount = state.messages.length;
  const result = await translatorSubgraph.invoke(state);
  return {
    sourceLanguage: result.sourceLanguage,
    targetLanguage: result.targetLanguage,
    messages: result.messages.slice(messageCount),
    steps: result.steps
  };
}

async function runSummarizerSubgraph(state: typeof SubgraphState.State) {
  const messageCount = state.messages.length;
  const result = await summarizerSubgraph.invoke(state);
  return {
    messages: result.messages.slice(messageCount),
    steps: result.steps
  };
}

export function buildSubgraphGraph() {
  return new StateGraph(SubgraphState)
    .addNode("classify", classify)
    .addNode("translator", runTranslatorSubgraph)
    .addNode("summarizer", runSummarizerSubgraph)
    .addNode("finalize_other", finalizeOther)
    .addEdge(START, "classify")
    .addConditionalEdges("classify", routeByIntent, {
      translate: "translator",
      summarize: "summarizer",
      other: "finalize_other"
    })
    .addEdge("translator", END)
    .addEdge("summarizer", END)
    .addEdge("finalize_other", END)
    .compile();
}

export const subgraphGraph = buildSubgraphGraph();
export const graph = subgraphGraph;
