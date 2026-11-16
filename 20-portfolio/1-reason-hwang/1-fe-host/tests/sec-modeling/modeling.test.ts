import test from "node:test";
import assert from "node:assert/strict";
import { mergeEvents, canStart, filingPath, isActive, type ModelingFiling } from "../../src/_pages/sec-modeling/model/types";
import { modelingRequest } from "../../src/_pages/sec-modeling/api/modelingApi";
const filing: ModelingFiling = { cik: "0000320193", accessionNo: "0000320193-26-000001", ticker: "AAPL", companyName: "Apple", formType: "10-K", reportDate: "2026-09-26", filingDate: "2026-10-30", hasSource: false, stages: {} };
test("stage 2 requires collected source and published stage 1, stage 3 requires raw input", () => {
  assert.equal(canStart(filing, 1), false);
  assert.equal(canStart({ ...filing, hasSource: true }, 3), true);
  assert.equal(canStart({ ...filing, hasSource: true }, 2), false);
  assert.equal(canStart({ ...filing, hasSource: true, stages: { "1": { status: "SUCCEEDED", generationId: "g1" } } }, 2), true);
});
test("only queued and running statuses keep polling alive", () => {
  assert.equal(isActive("QUEUED"), true); assert.equal(isActive("RUNNING"), true);
  for (const status of ["SUCCEEDED", "FAILED", "CANCELLED", undefined]) assert.equal(isActive(status), false);
});
test("filing URL segments cannot escape the selected path", () => { assert.equal(filingPath({ cik: "../", accessionNo: "a?b" }), "filings/..%2F/a%3Fb"); });
test("API request uses same-origin JSON and propagates meaningful upstream errors", async t => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.ok(url.startsWith("/api/remote-proxy/api/sec/modeling/"));
    assert.equal(init.method, "POST"); assert.equal(init.body, '{"query":"risk"}');
    return Response.json({ detail: "Embedding credential missing" }, { status: 503 });
  });
  await assert.rejects(modelingRequest("search", undefined, { query: "risk" }), /Embedding credential missing/);
});

test("incremental event pages retain history and deduplicate overlapping cursor fetches", () => {
  const event = (id: string) => ({ id, type: "progress", createdAt: "2026-11-14", payload: {} });
  assert.deepEqual(mergeEvents([event("1"), event("2")], [event("2"), event("3")]).map(item => item.id), ["1", "2", "3"]);
});


test("stage actions require collected source and current known model-1 publication", () => {
  assert.equal(canStart({ ...filing, stages: { "1": { status: "ready", generationId: "g1" } } }, 2), false);
  assert.equal(canStart({ ...filing, hasSource: true, stages: { "1": { status: "unavailable", readiness: "unavailable", generationId: "old" } } }, 2), false);
  assert.equal(canStart({ ...filing, hasSource: true, stages: { "1": { status: "stale", readiness: "stale", generationId: "old" } } }, 2), false);
  assert.equal(canStart({ ...filing, hasSource: true, formType: "10-Q" }, 1), false);
  assert.equal(canStart({ ...filing, hasSource: true, formType: "10-Q" }, 3), true);
});
