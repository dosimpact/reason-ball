import assert from "node:assert/strict";
import { test } from "node:test";
import { failureReason, requestFailureReply } from "../../src/_pages/sec-chat/api/failure-reply";

test("controlled failure reasons never expose exception text", () => {
  assert.equal(failureReason(new Error("세션이 만료되었습니다")), "session_expired");
  assert.equal(failureReason(new Error("최신 공시 다운로드가 완료되지 않았습니다")), "filing_not_ready");
  assert.equal(failureReason(new Error("저장된 10-K가 없습니다")), "filing_not_found");
  assert.equal(failureReason(new Error("Failed to fetch")), "connection_failed");
  assert.equal(failureReason(new Error("응답 형식 오류")), "invalid_response");
  assert.equal(failureReason(new Error("완료되기 전에 연결이 끊겼습니다")), "invalid_response");
  assert.equal(failureReason(new Error("private-token-and-internal-url")), "unknown");
});

test("failure reply sends only bounded safe context and validates model output", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.deepEqual(JSON.parse(String(options?.body)), { message: "질문", stage: "prepare", reason: "unknown", company: { cik: "1", name: "기업", ticker: "ABC" } });
      return Response.json({ reply: "  다시 시도해 주세요.  ", source: "model" });
    };
    assert.deepEqual(await requestFailureReply(" 질문 ", { stage: "prepare", company: { cik: "1", name: "기업", ticker: "ABC" } }, new AbortController().signal), { reply: "다시 시도해 주세요.", source: "model" });
    for (const response of [{ reply: "", source: "model" }, { reply: "a".repeat(2501), source: "model" }, { reply: "내용", source: "other" }]) {
      globalThis.fetch = async () => Response.json(response);
      const result = await requestFailureReply("질문", { stage: "collect" }, new AbortController().signal);
      assert.equal(result.source, "fallback"); assert.match(result.reply, /수집.*완료/);
    }
    globalThis.fetch = async () => { throw new Error("private error"); };
    const fallback = await requestFailureReply("질문", { stage: "chat" }, new AbortController().signal);
    assert.equal(fallback.source, "fallback"); assert.ok(fallback.reply); assert.doesNotMatch(fallback.reply, /private/);
  } finally { globalThis.fetch = original; }
});

test("cancellation during recovery propagates without fallback", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
    const result = requestFailureReply("질문", { stage: "resolve" }, controller.signal);
    controller.abort();
    await assert.rejects(result, { name: "AbortError" });
  } finally { globalThis.fetch = original; }
});
