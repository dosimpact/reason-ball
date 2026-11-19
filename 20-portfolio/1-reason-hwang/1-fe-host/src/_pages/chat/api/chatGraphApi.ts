import type { Client } from "@langchain/langgraph-sdk";

export type GraphOption = { id: string; name: string; mode: "chat" | "json"; inputSchema?: Record<string, unknown>; exampleInput?: Record<string, unknown>; schemaError?: string; description?: string };
const names: Record<string, string> = { talib_agent: "TA-Lib 채팅", starter_graph: "기본 채팅", simple_llm: "일반 에이전트", technical_analysis_agent: "기술적 분석 · 인라인", technical_analysis_canvas_agent: "기술적 분석 · Canvas", sec_deep_agent: "SEC Research", sec_modeling_agent: "SEC Modeling Chat", main_graph: "Main Graph", price_agent: "가격 조회", technical_analysis_graph: "기술적 분석 서브그래프", tenk_subgraph: "10-K 검색" };
const descriptions: Record<string, string> = {
 talib_agent: "가격과 TA-Lib 지표를 도구로 조회하고 근거를 대화로 설명합니다.",
 starter_graph: "일반 질문에 답하고 날씨 질문에는 날씨 도구를 사용하는 기본 대화 그래프입니다.",
 simple_llm: "일반 대화와 현재 날씨 도구 호출을 제공하는 간단한 에이전트입니다.",
 technical_analysis_agent: "주가와 기술 지표를 조회·분석하고 결과를 대화 안에 보여줍니다.",
 technical_analysis_canvas_agent: "주가와 기술 지표를 분석하고 보고서를 별도의 Canvas에서 살펴볼 수 있습니다.",
 sec_deep_agent: "저장된 SEC 기업과 공시를 조사하고 도구를 사용해 리서치 보고서를 작성합니다. 수집은 명시적으로 요청한 범위에서만 실행하세요.",
 sec_modeling_agent: "SEC 공시 모델링 관련 도구를 호출하고 모델링 작업과 검색 결과를 대화로 확인합니다.",
 main_graph: "메시지와 모델 제공자를 JSON으로 받아 언어 모델을 실행하는 기본 그래프입니다.",
 price_agent: "종목과 기간을 입력받아 과거 주가 데이터를 조회하는 그래프입니다.",
 technical_analysis_graph: "가격 배열을 입력받아 기술 지표를 계산합니다. messages로 대화하지만 분석에는 thread state에 실제 OHLCV prices 배열이 필요합니다. 가격을 직접 조회하려면 기술적 분석 · 인라인을 선택하세요.",
 tenk_subgraph: "저장된 10-K 자료에서 질문과 관련된 내용을 검색하고 답변과 근거를 반환합니다.",
};
const chat = new Set(["price_agent", "technical_analysis_graph", "talib_agent", "starter_graph", "simple_llm", "technical_analysis_agent", "technical_analysis_canvas_agent", "sec_deep_agent", "sec_modeling_agent"]);
const examples: Record<string, Record<string, unknown>> = {
 main_graph: { message: "안녕하세요", provider: "openai" },
 price_agent: { messages: [{ role: "user", content: "AAPL 최근 완료된 일봉 2개를 조회해 주세요" }] },
 technical_analysis_graph: { prices: [], interval: "1d" },
 tenk_subgraph: { query: "Apple의 최근 10-K 위험 요인을 저장된 자료에서 찾아 주세요", selected_filing: null },
};
export function graphOption(id: string): GraphOption { return { id, name: names[id] ?? id, mode: chat.has(id) ? "chat" : "json", exampleInput: examples[id] ?? {}, description: descriptions[id] ?? "이 그래프의 설명이 아직 등록되지 않았습니다. 입력 스키마를 확인해 주세요." }; }

export async function discoverGraphs(client: Client, signal?: AbortSignal): Promise<GraphOption[]> {
 const records = new Map<string, string>();
 const pageSize = 100;
 for (let offset = 0; ; offset += pageSize) {
  const rows = await client.assistants.search({ limit: pageSize, offset, signal });
  if (!Array.isArray(rows)) throw new Error("에이전트 목록 응답이 올바르지 않습니다.");
  for (const row of rows) if (typeof row.graph_id === "string" && typeof row.assistant_id === "string" && !records.has(row.graph_id)) records.set(row.graph_id, row.assistant_id);
  if (rows.length < pageSize) break;
 }
 return Promise.all([...records].map(async ([id, assistantId]) => {
  const option = graphOption(id);
  try { const schemas = await client.assistants.getSchemas(assistantId, { signal }); return { ...option, inputSchema: schemas.input_schema as Record<string, unknown> }; }
  catch (error) { if (signal?.aborted) throw error; return { ...option, schemaError: "입력 스키마를 불러오지 못했습니다. 다시 조회하거나 JSON 입력을 확인하세요." }; }
 }));
}

export async function runGraphInput(params: { client: Client; graphId: string; input: Record<string, unknown>; signal?: AbortSignal; runtimeId?: string; onRun?: (threadId: string, runId: string) => void; onThread?: (id: string) => void; onValues?: (values: unknown) => void }): Promise<unknown> {
 const thread = await params.client.threads.create({ graphId: params.graphId, metadata: { source: "host-chat", runtime: params.runtimeId, graph_id: params.graphId, title: `JSON 테스트 · ${params.graphId}` }, signal: params.signal });
 if (params.signal?.aborted) throw new DOMException("요청 중단", "AbortError");
 params.onThread?.(thread.thread_id);
 let result: unknown;
 let runId: string | undefined;
 for await (const event of params.client.runs.stream(thread.thread_id, params.graphId, { input: params.input, streamMode: "values", onDisconnect: "continue", onRunCreated: run => params.onRun?.(thread.thread_id, run.run_id), signal: params.signal })) {
  if (params.signal?.aborted) throw new DOMException("요청 중단", "AbortError");
  if (event.event === "metadata") { runId = (event.data as { run_id?: string })?.run_id; if (runId) params.onRun?.(thread.thread_id, runId); }
  if (event.event === "error") { const data = event.data as { message?: string; error?: string } | null; throw new Error(data?.message ?? data?.error ?? "그래프 실행에 실패했습니다."); }
  if (event.event === "values") { result = event.data; params.onValues?.(result); }
 }
 if (runId) {
  const run = await params.client.runs.get(thread.thread_id, runId, { signal: params.signal });
  if (params.signal?.aborted) throw new DOMException("요청 중단", "AbortError");
  if (run.status !== "success") throw new Error(`실행 완료를 확인하지 못했습니다 (상태: ${run.status}). 기록에서 서버 상태를 확인하세요.`);
 } else throw new Error("실행 ID를 받지 못해 완료 상태를 확인할 수 없습니다.");
 if (result === undefined) throw new Error("실행 결과를 받지 못했습니다. 입력 스키마와 서버 상태를 확인하세요.");
 return result;
}
