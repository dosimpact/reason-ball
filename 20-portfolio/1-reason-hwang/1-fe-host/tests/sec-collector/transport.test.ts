import assert from "node:assert/strict";
import test from "node:test";
import { streamCollection } from "../../src/_pages/sec-collector/api/collectionStream";
import { fetchFilings, fetchOverview, secApiUrl, syncCompanies } from "../../src/_pages/sec-collector/api/secCollectorApi";
import { buildCollectionInput, createRequestRevision, resetPage } from "../../src/_pages/sec-collector/model/collectionInput";

function stream(text: string, width = 3) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += width) controller.enqueue(bytes.slice(i, i + width)); controller.close(); } }), { headers: { "Content-Type": "text/event-stream" } });
}
test("split UTF8 CRLF SSE ignores heartbeat and classifies partial final result", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return stream(': heartbeat\r\n\r\nevent: started\r\ndata: {}\r\n\r\nevent: progress\r\ndata: {"phase":"documents","message":"수집"}\r\n\r\nevent: completed\r\ndata: {"downloaded":2,"failed":1}\r\n\r\n'); };
  try { const events: string[] = []; const result = await streamCollection("all", {}, event => events.push(event.type)); assert.equal(result.status, "partial"); assert.deepEqual(events, ["started", "progress", "completed"]); assert.equal(calls, 1); } finally { globalThis.fetch = original; }
});
test("HTTP200 SSE error and missing terminal never count as success", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => stream('event: error\ndata: {"statusCode":409,"message":"already active"}\n\n');
    assert.equal((await streamCollection("all", {}, () => {})).status, "error");
    globalThis.fetch = async () => stream('event: progress\ndata: {}\n\n');
    assert.equal((await streamCollection("all", {}, () => {})).status, "disconnected");
  } finally { globalThis.fetch = original; }
});
test("overview uses the server aggregate endpoint", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async input => { urls.push(String(input)); return Response.json({ companies: 101, tickerCompanies: 99, totalFilings: 202, contentFilings: 42, forms: [], retrievedAt: "2026-11-16T00:00:00Z" }); };
  try { const overview = await fetchOverview(); assert.equal(overview.companies, 101); assert.equal(overview.totalFilings, 202); assert.deepEqual(urls, ["/api/remote-proxy/api/sec/overview"]); await assert.rejects(fetchFilings({ page: 1, pageSize: 50, includeFormerRegistrants: true })); } finally { globalThis.fetch = original; }
});
test("collection inputs normalize targets, dates replace years, state rejects stale lists", () => {
  assert.deepEqual(buildCollectionInput("selected", { tickers: [" aapl "], since: "2020-01-01", years: 20 }), { downloadDocuments: true, refreshArchive: false, tickers: ["AAPL"], since: "2020-01-01" });
  assert.deepEqual(buildCollectionInput("all", {}), { downloadDocuments: true, refreshArchive: false, years: 20 });
  assert.throws(() => buildCollectionInput("selected", {})); assert.throws(() => buildCollectionInput("selected", { tickers: ["AAPL"], since: "" })); assert.throws(() => buildCollectionInput("selected", { ciks: ["1"], since: "2026-02-30" }));
  assert.equal(resetPage({ page: 3, q: "old" }, { q: "new" }).page, 1);
  const revision = createRequestRevision(); const old = revision.next(); const current = revision.next(); assert.equal(revision.isCurrent(old), false); assert.equal(revision.isCurrent(current), true);
});
test("HTTP errors and traces preserve status; mutations never retry", async () => {
  const original = globalThis.fetch; let count = 0; const statuses: number[] = [];
  globalThis.fetch = async () => { count++; return Response.json({ message: "unavailable" }, { status: 503 }); };
  try { await assert.rejects(syncCompanies(undefined, trace => statuses.push(trace.status)), /unavailable/); assert.deepEqual(statuses, [503]); assert.equal(count, 1); } finally { globalThis.fetch = original; }
});
test("abort releases owned stream and malformed event never succeeds", async () => {
  const original = globalThis.fetch;
  let cancelled = false;
  const abort = new AbortController();
  globalThis.fetch = async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "Content-Type": "text/event-stream" } });
  try {
    const promise = streamCollection("all", {}, () => {}, abort.signal);
    setTimeout(() => abort.abort(), 5);
    await assert.rejects(promise, { name: "AbortError" });
    assert.equal(cancelled, true);
    globalThis.fetch = async () => stream('event: completed\ndata: not-json\n\n');
    assert.equal((await streamCollection("all", {}, () => {})).status, "disconnected");
  } finally { globalThis.fetch = original; }
});

test("empty parser status is a real unprocessed filter while blank search is omitted", () => {
  const url = secApiUrl("filings", { parserStatus: "", ticker: "", page: 1 });
  assert.ok(url.includes("parserStatus="));
  assert.ok(!url.includes("ticker="));
});
