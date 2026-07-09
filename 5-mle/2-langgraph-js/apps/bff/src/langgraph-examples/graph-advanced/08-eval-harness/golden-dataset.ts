export interface GoldenDatasetRow {
  id: string;
  input: string;
  expectedKeywords: readonly string[];
  expectedToolCalls: readonly string[];
}

export const GOLDEN_DATASET = [
  {
    id: "time-1",
    input: "지금 몇 시야?",
    expectedKeywords: ["KST"],
    expectedToolCalls: ["get_current_time"]
  },
  {
    id: "time-2",
    input: "What time is it now?",
    expectedKeywords: ["KST"],
    expectedToolCalls: ["get_current_time"]
  },
  {
    id: "calc-1",
    input: "123 * 456 계산해줘",
    expectedKeywords: ["56088"],
    expectedToolCalls: ["calculate"]
  },
  {
    id: "calc-2",
    input: "(15 + 27) / 6 은 얼마야?",
    expectedKeywords: ["7"],
    expectedToolCalls: ["calculate"]
  },
  {
    id: "lookup-1",
    input: "langgraph 가 뭐야?",
    expectedKeywords: ["LangGraph", "stateful"],
    expectedToolCalls: ["lookup_info"]
  },
  {
    id: "lookup-2",
    input: "bedrock 에 대해 알려줘",
    expectedKeywords: ["Bedrock", "foundation"],
    expectedToolCalls: ["lookup_info"]
  },
  {
    id: "lookup-3",
    input: "fastapi 설명해줘",
    expectedKeywords: ["FastAPI", "Python"],
    expectedToolCalls: ["lookup_info"]
  },
  {
    id: "no-tool-1",
    input: "안녕!",
    expectedKeywords: [],
    expectedToolCalls: []
  },
  {
    id: "multi-1",
    input: "지금 몇 시인지 알려주고, 12 * 7 도 계산해줘",
    expectedKeywords: ["KST", "84"],
    expectedToolCalls: ["get_current_time", "calculate"]
  },
  {
    id: "multi-2",
    input: "langgraph 설명해주고 fastapi 도 같이 알려줘",
    expectedKeywords: ["LangGraph", "FastAPI"],
    expectedToolCalls: ["lookup_info"]
  }
] as const satisfies readonly GoldenDatasetRow[];
