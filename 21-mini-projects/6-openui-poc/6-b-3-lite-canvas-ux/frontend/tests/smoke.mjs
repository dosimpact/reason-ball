/*
 * 실행 중인 프런트엔드와 Python 서버를 통해 실제 모델·도구·스트림·후속 질문을 확인합니다.
 * 단위 테스트와 달리 API 키와 호출 비용이 필요하며 결과를 output/validation에 저장합니다.
 */
/** Real provider smoke test. Requires both servers and uses the server's API key. */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";

import { createParser } from "@openuidev/lang-core";
const spec = JSON.parse(await readFile(new URL("../src/generated/spec.json", import.meta.url), "utf8"));
const parser = createParser(spec.schema, spec.root);
const base = process.env.CHAT_TEST_URL || "http://127.0.0.1:3044";
const output = new URL("../output/validation/", import.meta.url);
await mkdir(output, { recursive: true });

async function chat(name, messages, expectedTools = []) {
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(120_000),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  const stream = await response.text();
  await writeFile(new URL(`${name}.sse`, output), stream);
  const events = stream.split(/\r?\n/).filter(line => line.startsWith("data:"))
    .map(line => JSON.parse(line.slice(5)));
  assert.equal(events[0]?.type, "RUN_STARTED");
  assert.equal(events.at(-1)?.type, "RUN_FINISHED", JSON.stringify(events.at(-1)));
  assert.ok(!events.some(event => event.type === "RUN_ERROR"));
  const text = events.filter(event => event.type === "TEXT_MESSAGE_CONTENT").map(event => event.delta).join("");
  assert.ok(text.length > 0, "Assistant text must reach the UI");
  const parsed = parser.parse(text);
  assert.ok(parsed.root, "Generated answer must have a renderable root");
  assert.deepEqual(parsed.meta.errors, [], "Answer must follow the Intelligent UI catalog");
  assert.deepEqual(parsed.meta.unresolved, [], "All UI references must resolve");
  const calls = events.filter(event => event.type === "TOOL_CALL_START");
  for (const tool of expectedTools) assert.ok(calls.some(call => call.toolCallName === tool), `Missing tool ${tool}`);
  for (const call of calls) {
    const matching = events.filter(event => event.toolCallId === call.toolCallId);
    assert.equal(matching.filter(event => event.type === "TOOL_CALL_START").length, 1);
    assert.equal(matching.filter(event => event.type === "TOOL_CALL_END").length, 1);
    assert.equal(matching.filter(event => event.type === "TOOL_CALL_RESULT").length, 1);
    JSON.parse(matching.filter(event => event.type === "TOOL_CALL_ARGS").map(event => event.delta).join(""));
  }
  const starts = events.filter(event => event.type === "TEXT_MESSAGE_START");
  for (const start of starts) assert.equal(events.filter(event => event.type === "TEXT_MESSAGE_END" && event.messageId === start.messageId).length, 1);
  console.log(`${name}: PASS (${text.length} text chars; tools: ${calls.map(call => call.toolCallName).join(", ")})`);
  return events;
}

const user = (id, content) => ({ id, role: "user", content });
const first = user("smoke-1", "Use get_stock_price for AAPL and search_web for James Webb Space Telescope. Show both results in simple cards.");
const events = await chat("stock-research", [first], ["get_stock_price", "search_web"]);
// Reconstruct the same AG-UI transcript that the browser sends on its next turn.
const history = [first];
for (const event of events) {
  if (event.type === "TOOL_CALL_START") {
    history.push({ id: `assistant-${event.toolCallId}`, role: "assistant", content: "", toolCalls: [{
      id: event.toolCallId, type: "function", function: { name: event.toolCallName,
        arguments: events.filter(e => e.type === "TOOL_CALL_ARGS" && e.toolCallId === event.toolCallId).map(e => e.delta).join("") },
    }] });
    const result = events.find(e => e.type === "TOOL_CALL_RESULT" && e.toolCallId === event.toolCallId);
    history.push({ id: result.messageId, role: "tool", toolCallId: event.toolCallId, content: result.content });
  } else if (event.type === "TEXT_MESSAGE_START") {
    history.push({ id: event.messageId, role: "assistant", content: events.filter(e => e.type === "TEXT_MESSAGE_CONTENT" && e.messageId === event.messageId).map(e => e.delta).join("") });
  }
}
await chat("follow-up", [...history, user("smoke-2", "Summarize those previous results in one sentence. Do not use tools again.")]);
await chat("interactive-counter", [user("counter", "Build a working counter starting at 0 using $count, a Text display using size lg (Text allows xs/sm/md/lg only), and a Button labeled Increment that uses @Set to add 1. Use Col as root. Do not call any tools.")]);
for (const body of ["{", JSON.stringify({ messages: [] })]) {
  const response = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  assert.equal(response.status, 400);
}
console.log("invalid requests: PASS (400)");
await writeFile(new URL("smoke-result.json", output), JSON.stringify({ result: "PASS", checkedAt: new Date().toISOString(), cases: ["stock-research", "follow-up", "interactive-counter", "invalid requests"] }, null, 2));
