import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "@langchain/langgraph-sdk";
import { discoverGraphs, graphOption, runGraphInput } from "../../src/_pages/chat/api/chatGraphApi";

test("discovers every page, deduplicates graphs and keeps unknown/schema failures selectable", async () => {
 const offsets: number[] = [];
 const client = { assistants: {
  search: async ({ offset }: { offset: number }) => { offsets.push(offset); return offset === 0 ? Array.from({ length: 100 }, (_, i) => ({ graph_id: i === 0 ? "starter_graph" : `graph_${i}`, assistant_id: `a_${i}` })) : [{ graph_id: "starter_graph", assistant_id: "duplicate" }, { graph_id: "last_graph", assistant_id: "schema_fail" }]; },
  getSchemas: async (id: string) => { if (id === "schema_fail") throw new Error("unavailable"); return { input_schema: { properties: { query: { type: "string" } } } }; },
 } } as unknown as Client;
 const graphs = await discoverGraphs(client);
 assert.deepEqual(offsets, [0, 100]); assert.equal(graphs.length, 101);
 assert.equal(graphs.find(item => item.id === "starter_graph")?.mode, "chat");
 assert.equal(graphs.find(item => item.id === "last_graph")?.mode, "json");
 assert.ok(graphs.find(item => item.id === "last_graph")?.schemaError);
 assert.equal(graphOption("technical_analysis_graph").mode, "chat");
});
test("nonchat input passes unchanged into a fresh isolated thread and returns latest values", async () => {
 const inputs: unknown[] = []; let threads = 0;
 const client = { threads: { create: async (args: unknown) => { inputs.push(args); return { thread_id: `thread_${++threads}` }; } }, runs: { get: async () => ({ status: "success" }), stream: async function* (id: string, graph: string, options: { input: unknown; streamMode: string }) { inputs.push({ id, graph, options }); yield { event: "metadata", data: { run_id: "run-test" } }; yield { event: "values", data: { response: "initial" } }; yield { event: "values", data: { response: "final" } }; } } } as unknown as Client;
 const input = { message: "hello", provider: "openai" };
 const values: unknown[] = [];
 assert.deepEqual(await runGraphInput({ client, graphId: "main_graph", input, onValues: value => values.push(value) }), { response: "final" });
 await runGraphInput({ client, graphId: "main_graph", input });
 assert.equal(threads, 2); assert.deepEqual(values, [{ response: "initial" }, { response: "final" }]);
 assert.deepEqual((inputs[1] as { options: { input: unknown } }).options.input, input);
});
test("runtime input errors and empty streams surface errors rather than invented output", async () => {
 const client = { threads: { create: async () => ({ thread_id: "test" }) }, runs: { stream: async function* () { yield { event: "error", data: { message: "prices is required" } }; } } } as unknown as Client;
 await assert.rejects(runGraphInput({ client, graphId: "technical_analysis_graph", input: {} }), /prices is required/);
 const empty = { ...client, runs: { stream: async function* () {} } } as unknown as Client;
 await assert.rejects(runGraphInput({ client: empty, graphId: "unknown", input: {} }), /실행 ID/);
});
test("values snapshots from an unfinished run cannot become a successful test result", async () => {
 const client = { threads: { create: async () => ({ thread_id: "test" }) }, runs: { get: async () => ({ status: "running" }), stream: async function* () { yield { event: "metadata", data: { run_id: "incomplete" } }; yield { event: "values", data: { partial: true } }; } } } as unknown as Client;
 await assert.rejects(runGraphInput({ client, graphId: "main_graph", input: { message: "test" } }), /완료를 확인/);
});

test("cancellation is recognized by SDK retry detection instead of occupying its request queue", async () => {
 const { cancellationAwareFetch } = await import("../../src/_pages/chat/api/langgraphClient");
 const original = globalThis.fetch;
 const controller = new AbortController();
 let requests = 0;
 globalThis.fetch = async () => { requests++; controller.abort(); throw new DOMException("signal is aborted without reason", "AbortError"); };
 try {
  await assert.rejects(cancellationAwareFetch("http://localhost/test", { signal: controller.signal }), error => error instanceof DOMException && error.name === "AbortError" && error.message.startsWith("AbortError"));
  await assert.rejects(cancellationAwareFetch("http://localhost/test", { signal: controller.signal }), /AbortError/);
  assert.equal(requests, 1);
  const timedOut = AbortSignal.abort(new DOMException("request timeout", "TimeoutError"));
  await assert.rejects(cancellationAwareFetch("http://localhost/test", { signal: timedOut }), error => error instanceof DOMException && error.name === "TimeoutError");
 } finally { globalThis.fetch = original; }
});
test("four aborted history requests release SDK queue slots for a fresh thread promptly", async () => {
 const { createLangGraphClient } = await import("../../src/_pages/chat/api/langgraphClient");
 const original = globalThis.fetch;
 const controllers = Array.from({ length: 4 }, () => new AbortController());
 let started = 0;
 let allStarted!: () => void;
 const ready = new Promise<void>(resolve => { allStarted = resolve; });
 globalThis.fetch = async (input, init) => {
  if (String(input).endsWith("/threads/search")) {
   started++; if (started === 4) allStarted();
   return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("signal is aborted without reason", "AbortError")), { once: true }));
  }
  return Response.json({ thread_id: "fresh-thread" });
 };
 try {
  const client = createLangGraphClient({ apiUrl: "http://localhost/sdk-test", assistantId: "starter_graph", streamMode: "values" });
  const histories = controllers.map(controller => client.threads.search({ signal: controller.signal }).catch(error => error));
  await ready; controllers.forEach(controller => controller.abort());
  const timeout = AbortSignal.timeout(1000);
  const thread = await client.threads.create({ signal: timeout });
  assert.equal(thread.thread_id, "fresh-thread");
  await Promise.all(histories);
 } finally { globalThis.fetch = original; }
});

test("TA-Lib is a native conversation graph with its own label", () => {
 assert.equal(graphOption("talib_agent").mode, "chat");
 assert.equal(graphOption("talib_agent").name, "TA-Lib 채팅");
});


test("SEC Modeling Chat discovery retains chat input and dedicated identity", async () => {
 const client = { assistants: {
  search: async () => [{ graph_id: "sec_modeling_agent", assistant_id: "sec-modeling" }],
  getSchemas: async () => ({ input_schema: { properties: { messages: { type: "array" } } } }),
 } } as unknown as Client;
 const [graph] = await discoverGraphs(client);
 assert.equal(graph.id, "sec_modeling_agent");
 assert.equal(graph.name, "SEC Modeling Chat");
 assert.equal(graph.mode, "chat");
 assert.ok(graph.inputSchema);
});

test("message-based price graphs use chat while structured graphs retain JSON", () => {
 for (const id of ["price_agent", "technical_analysis_graph"]) assert.equal(graphOption(id).mode, "chat");
 for (const id of ["main_graph", "tenk_subgraph"]) assert.equal(graphOption(id).mode, "json");
});
