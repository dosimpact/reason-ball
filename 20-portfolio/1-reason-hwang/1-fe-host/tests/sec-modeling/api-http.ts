/** API-only executor integration against the explicitly owned Nest fixture. */
import assert from "node:assert/strict";
import { buildModelingTestRequest } from "../../src/_pages/sec-modeling/model/apiTesting";
import { executeModelingTest } from "../../src/_pages/sec-modeling/api/apiTesting";

async function main() {
  const base = process.env.SEC_MODELING_TEST_BASE;
  assert.equal(base, "http://127.0.0.1:3980", "Use only the owned fixture server");
  const nativeFetch = globalThis.fetch;
  let executorCalls = 0;
  let sentBody: BodyInit | null | undefined;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    assert.ok(url.startsWith("/api/remote-proxy/api/sec/modeling/"));
    executorCalls++;
    sentBody = init?.body;
    return nativeFetch(url.replace("/api/remote-proxy", base), init);
  }) as typeof fetch;
  try {
    const overview = buildModelingTestRequest({ presetId: "overview", query: { q: "aapl" }, params: {}, body: "" });
    assert.equal(executorCalls, 0, "Constructing a preset must not issue a request");
    const result = await executeModelingTest(overview);
    assert.equal(result.status, 200);
    assert.equal(result.outcome, "success");
    assert.equal((result.body as { totalFilings: number }).totalFilings, 2);
    assert.ok(result.headers["content-type"].includes("application/json"));
    assert.ok(result.durationMs >= 0);
    assert.deepEqual(result.request, overview);
    const before = await (await nativeFetch(`${base}/api/sec/modeling/runs?limit=100`)).json();
    const invalid = buildModelingTestRequest({ presetId: "create-1", query: {}, params: { cik: "0000320193", accessionNo: "0000320193-26-000001" }, body: "null" });
    const failure = await executeModelingTest(invalid);
    assert.equal(sentBody, "null");
    assert.equal(failure.request.body, "null");
    assert.equal(failure.status, 400);
    assert.equal(failure.outcome, "http-error");
    assert.ok(failure.bodyText.length > 0);
    const after = await (await nativeFetch(`${base}/api/sec/modeling/runs?limit=100`)).json();
    assert.equal(after.total, before.total, "Invalid schema must not create a modeling job");
    assert.equal(executorCalls, 2);
    console.log(JSON.stringify({ passed: 2, overviewStatus: result.status, invalidStatus: failure.status, rawBody: "null", runsUnchanged: after.total }));
  } finally {
    globalThis.fetch = nativeFetch;
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
