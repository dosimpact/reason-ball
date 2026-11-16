import test from "node:test";
import assert from "node:assert/strict";
import { buildModelingTestRequest, assertModelingTestRequest, modelingPresets } from "../../src/_pages/sec-modeling/model/apiTesting";
import { executeModelingTest } from "../../src/_pages/sec-modeling/api/apiTesting";
const params = { cik: "0000320193", accessionNo: "0000320193-26-000001", runId: "11111111-1111-4111-8111-111111111111", stage: "3", evidenceId: "statement:sample" };
test("all fixed modeling presets produce allowlisted same-origin requests without fetching", () => {
  assert.equal(modelingPresets.length, 15);
  for (const preset of modelingPresets) assert.doesNotThrow(() => assertModelingTestRequest(buildModelingTestRequest({ presetId: preset.id, params, query: preset.query, body: preset.body ?? "" })));
});
test("schema-invalid JSON and query values remain unchanged for server validation", () => {
  const body = '  null\n';
  const request = buildModelingTestRequest({ presetId: "create-1", params, query: { extra: "invalid" }, body });
  assert.equal(request.body, body);
  assert.match(request.url, /extra=invalid/);
  assert.throws(() => buildModelingTestRequest({ presetId: "create-1", params, query: {}, body: "{broken" }));
});
test("URL, path traversal, foreign methods and auth header injection cannot escape fixed presets", () => {
  assert.throws(() => buildModelingTestRequest({ presetId: "evidence", params: { evidenceId: "../runs" }, query: {}, body: "" }));
  assert.throws(() => buildModelingTestRequest({ presetId: "evidence", params: { evidenceId: "%2e%2e%2fruns" }, query: {}, body: "" }));
  assert.throws(() => assertModelingTestRequest({ method: "GET", url: "https://example.com/overview", headers: {} }));
  const request = buildModelingTestRequest({ presetId: "overview", params, query: {}, body: "" });
  assert.throws(() => assertModelingTestRequest({ ...request, headers: { Authorization: "not-accepted" } }));
});
test("HTTP errors remain inspectable and preserve the exact sent body", async t => {
  const request = buildModelingTestRequest({ presetId: "create-1", params, query: {}, body: "null" });
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.body, "null");
    return Response.json({ message: "Body must be an object" }, { status: 400, headers: { "x-request-id": "fixture" } });
  });
  const result = await executeModelingTest(request);
  assert.equal(result.outcome, "http-error"); assert.equal(result.status, 400); assert.deepEqual(result.body, { message: "Body must be an object" });
  assert.equal(result.request.body, "null"); assert.equal(result.headers["x-request-id"], "fixture");
});


test("HTTP202 retains accepted job identity without manufacturing a completed result", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ runId: "fixture-run", status: "QUEUED" }, { status: 202 }));
  const request = buildModelingTestRequest({ presetId: "create-3", params, query: {}, body: "{}" });
  const result = await executeModelingTest(request);
  assert.equal(result.status, 202); assert.deepEqual(result.body, { runId: "fixture-run", status: "QUEUED" });
  assert.equal(result.request.method, "POST");
});
