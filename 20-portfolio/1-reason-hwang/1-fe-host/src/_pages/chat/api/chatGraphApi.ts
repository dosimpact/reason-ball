import type { Client } from "@langchain/langgraph-sdk";

export type GraphOption = { id: string; name: string; mode: "chat" | "json"; inputSchema?: Record<string, unknown>; exampleInput?: Record<string, unknown>; schemaError?: string; description?: string };
const names: Record<string, string> = { starter_graph: "기본 채팅", simple_llm: "일반 에이전트", technical_analysis_agent: "기술적 분석", sec_deep_agent: "SEC Research", main_graph: "Main Graph", price_agent: "가격 조회", technical_analysis_graph: "기술적 분석 서브그래프", tenk_subgraph: "10-K 검색", simple_push_ui_message: "Push UI 예제" };
const chat = new Set(["starter_graph", "simple_llm", "technical_analysis_agent", "sec_deep_agent"]);
const examples: Record<string, Record<string, unknown>> = {
 main_graph: { message: "안녕하세요", provider: "openai" },
 price_agent: { query: "AAPL 최근 완료된 일봉 2개를 조회해 주세요", interval: "1d", count: 2 },
 technical_analysis_graph: { prices: [], interval: "1d" },
 tenk_subgraph: { query: "Apple의 최근 10-K 위험 요인을 저장된 자료에서 찾아 주세요", selected_filing: null },
 simple_push_ui_message: { messages: [{ role: "user", content: "안녕하세요" }], turn_id: "test-turn", ui: [], model_calls: 0 },
};
export function graphOption(id: string): GraphOption { return { id, name: names[id] ?? id, mode: chat.has(id) ? "chat" : "json", exampleInput: examples[id] ?? {}, description: id === "technical_analysis_graph" ? "실제 OHLCV prices 배열을 입력하세요. 가격 조회 그래프 결과의 prices를 사용할 수 있습니다. 빈 배열은 입력 검증 오류를 확인하는 예시입니다." : id === "sec_deep_agent" ? "SEC 도구가 포함됩니다. 수집은 명시적으로 요청한 범위에서만 실행하세요." : undefined }; }

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

export async function runGraphInput(params: { client: Client; graphId: string; input: Record<string, unknown>; signal?: AbortSignal; onThread?: (id: string) => void; onValues?: (values: unknown) => void }): Promise<unknown> {
 const thread = await params.client.threads.create({ graphId: params.graphId, metadata: { source: "host-chat", graph_id: params.graphId, title: `JSON 테스트 · ${params.graphId}` }, signal: params.signal });
 if (params.signal?.aborted) throw new DOMException("요청 중단", "AbortError");
 params.onThread?.(thread.thread_id);
 let result: unknown;
 let runId: string | undefined;
 for await (const event of params.client.runs.stream(thread.thread_id, params.graphId, { input: params.input, streamMode: "values", signal: params.signal })) {
  if (params.signal?.aborted) throw new DOMException("요청 중단", "AbortError");
  if (event.event === "metadata") runId = (event.data as { run_id?: string })?.run_id;
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
