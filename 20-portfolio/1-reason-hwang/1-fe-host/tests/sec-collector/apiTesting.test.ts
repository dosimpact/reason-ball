import assert from "node:assert/strict";
import test from "node:test";
import { buildTestRequest } from "../../src/_pages/sec-collector/model/apiTesting";
import { executeTestRequest } from "../../src/_pages/sec-collector/api/apiTesting";

test("schema-invalid JSON and query values are transmitted unchanged for server validation", async () => {
 const original = globalThis.fetch;
 const raw = '{ "years": "bad", "downloadDocuments": 99 }';
 const request = buildTestRequest({ presetId: "selected-sync", query: { page: "bad", includeContent: "false", parserStatus: "" }, bodyText: raw });
 globalThis.fetch = async (url, init) => { assert.equal(init?.body, raw); assert.ok(String(url).includes("includeContent=false")); assert.ok(String(url).includes("parserStatus=")); return Response.json({ message: ["years must be integer"] }, { status: 400, headers: { "x-request-id": "test" } }); };
 try { const result = await executeTestRequest(request); assert.equal(result.outcome, "http-error"); assert.equal(result.status, 400); assert.deepEqual(result.body, { message: ["years must be integer"] }); assert.equal(result.headers["x-request-id"], "test"); } finally { globalThis.fetch = original; }
});
test("fixed presets and identifier guards prevent external URLs and path traversal", async () => {
 assert.throws(() => buildTestRequest({ presetId: "https://evil.invalid", query: {}, bodyText: "" }));
 assert.throws(() => buildTestRequest({ presetId: "content", query: {}, bodyText: "", cik: "../companies", accessionNo: "0000320193-26-000001" }));
 const good = buildTestRequest({ presetId: "companies", query: { q: "https://evil.invalid/a?b=c" }, bodyText: "" });
 assert.ok(good.url.startsWith("/api/remote-proxy/api/sec/companies?"));
 await assert.rejects(executeTestRequest({ ...good, url: "https://evil.invalid" }));
 assert.throws(() => buildTestRequest({ presetId: "all-sync", query: {}, bodyText: "not-json" }));
});
test("nonJSON content is plain inspectable text and split SSE preserves terminal distinction", async () => {
 const original = globalThis.fetch;
 try {
  globalThis.fetch = async () => new Response("<script>never execute</script>", { headers: { "content-type": "text/html" } });
  const content = await executeTestRequest(buildTestRequest({ presetId: "content", query: {}, bodyText: "", cik: "320193", accessionNo: "0000320193-26-000001" }));
  assert.equal(content.body, "<script>never execute</script>");
  const request = buildTestRequest({ presetId: "all-sync", query: {}, bodyText: "{}" });
  const response = (text: string) => { const bytes = new TextEncoder().encode(text); return new Response(new ReadableStream({ start(c) { for (let i=0;i<bytes.length;i+=2) c.enqueue(bytes.slice(i,i+2)); c.close(); } }), { headers: { "content-type": "text/event-stream" } }); };
  globalThis.fetch = async () => response(': heartbeat\r\n\r\nevent: progress\r\ndata: {"message":"수집"}\r\n\r\nevent: completed\r\ndata: {"failed":1}\r\n\r\n');
  const partial = await executeTestRequest(request); assert.equal(partial.outcome, "partial"); assert.equal(partial.events.length, 2);
  globalThis.fetch = async () => response('event: error\ndata: {"message":"unknown company","statusCode":404}\n\n');
  const failure = await executeTestRequest(request); assert.equal(failure.status, 200); assert.equal(failure.outcome, "sse-error");
  globalThis.fetch = async () => Response.json({ unexpected: true }); assert.equal((await executeTestRequest(request)).outcome, "disconnected");
  globalThis.fetch = async () => new Response(null, { status: 204 }); assert.equal((await executeTestRequest(request)).outcome, "disconnected");
  globalThis.fetch = async () => response('event: progress\ndata: {}\n\n'); assert.equal((await executeTestRequest(request)).outcome, "disconnected");
 } finally { globalThis.fetch = original; }
});
test("transport cancellation releases reader, network errors stay separate, previews are bounded", async () => {
 const original = globalThis.fetch;
 const request = buildTestRequest({ presetId: "companies", query: {}, bodyText: "" });
 try {
  globalThis.fetch = async () => { throw new TypeError("network unavailable"); };
  const network = await executeTestRequest(request); assert.equal(network.outcome, "network-error"); assert.equal(network.status, null);
  let cancelled = false; const controller = new AbortController();
  globalThis.fetch = async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "content-type": "text/event-stream" } });
  const pending = executeTestRequest(request, undefined, controller.signal); setTimeout(() => controller.abort(), 5);
  assert.equal((await pending).outcome, "aborted"); assert.equal(cancelled, true);
  globalThis.fetch = async () => new Response("x".repeat(1024 * 1024 + 20));
  const preview = await executeTestRequest(request); assert.equal(preview.truncated, true); assert.equal(preview.bodyText.length, 1024 * 1024);
  await assert.rejects(executeTestRequest({ ...request, method: "POST" }));
  await assert.rejects(executeTestRequest({ ...request, headers: { Authorization: "not-allowed" } }));
 } finally { globalThis.fetch = original; }
});
