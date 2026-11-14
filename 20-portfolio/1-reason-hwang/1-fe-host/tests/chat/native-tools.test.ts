import assert from "node:assert/strict";
import test from "node:test";
import { pairToolActivity } from "@openuidev/react-ui";
import { projectNativeToolMessages } from "../../src/_pages/chat/model/nativeToolMessages";
import { normalizeThreadMessages } from "../../src/_pages/chat/api/chatHistoryApi";
import { streamChatRun } from "../../src/_pages/chat/api/chatRunApi";
import type { ChatMessage } from "../../src/_pages/chat/model/chatTypes";
import type { Client } from "@langchain/langgraph-sdk";

const message = (id: string, activities: ChatMessage["activities"], status: ChatMessage["status"] = "streaming"): ChatMessage => ({ id, role: "assistant", content: "verified answer", createdAt: "2026-11-14", status, activities });
test("native SDK pairs sanitized real statuses above the original assistant without extra model data", () => {
 const projection = projectNativeToolMessages([message("answer", [
  { id: "a", name: "lookup", status: "running" }, { id: "b", name: "analyze", status: "complete" },
  { id: "c", name: "fetch", status: "error" }, { id: "d", name: "search", status: "interrupted" },
 ])]);
 const assistant = projection.messages[0];
 assert.equal(assistant.id, "answer");
 if (assistant.role !== "assistant") throw new Error("expected assistant");
 const activities = pairToolActivity(assistant, projection.messages, projection.executingToolCallIds);
 assert.deepEqual(activities.map(activity => activity.status), ["executing", "complete", "error", "error"]);
 assert.equal(activities[3].errorText, "실행이 중단되었습니다.");
 assert.deepEqual(activities.map(activity => activity.input), [{}, {}, {}, {}]);
 assert.equal(projection.messages.filter(item => item.role === "assistant").length, 1);
});
test("two restored turns retain final answer ids, isolate repeated calls and never expose arguments/results/intermediate prose", () => {
 const restored = normalizeThreadMessages({ values: { messages: [
  { id: "q1", type: "human", content: "first" },
  { id: "intermediate", type: "ai", content: "SECRET_INTERMEDIATE" },
  { type: "ai", content: "SECRET_REASONING", tool_calls: [{ id: "same", name: "lookup", args: { secret: "SECRET_ARG" } }, { id: "same", name: "lookup" }] },
  { type: "tool", tool_call_id: "same", content: "SECRET_RESULT" },
  { id: "a1", type: "ai", content: "first answer" },
  { id: "q2", type: "human", content: "second" },
  { type: "ai", tool_calls: [{ id: "same", name: "lookup", args: { secret: "SECRET_ARG" } }] },
  { type: "tool", tool_call_id: "same", status: "error", content: "SECRET_ERROR_RESULT" },
  { id: "a2", type: "ai", content: "second answer" },
 ] } });
 assert.deepEqual(restored.map(item => item.id), ["q1", "a1", "q2", "a2"]);
 assert.equal(restored[1].activities?.length, 1);
 assert.equal(restored[1].activities?.[0].status, "complete");
 assert.equal(restored[3].activities?.[0].status, "error");
 const projected = projectNativeToolMessages(restored);
 assert.equal(projected.executingToolCallIds.size, 0);
 assert.ok(!JSON.stringify(projected.messages).includes("SECRET"));
 const calls = projected.messages.filter(item => item.role === "tool").map(item => item.toolCallId);
 assert.notEqual(calls[0], calls[1]);
});
test("unfinished historical tool calls cannot become fake success", () => {
 const restored = normalizeThreadMessages({ values: { messages: [{ type: "human", content: "question" }, { id: "tool-owner", type: "ai", tool_calls: [{ id: "pending", name: "lookup" }] }] } });
 assert.equal(restored[1].id, "tool-owner");
 assert.equal(restored[1].activities?.[0].status, "interrupted");
 const projected = projectNativeToolMessages(restored);
 const result = projected.messages.find(item => item.role === "tool");
 assert.equal(result?.role === "tool" ? result.error : undefined, "실행이 중단되었습니다.");
});
test("token-configured chat adds values metadata once without changing input or adding a model call", () => {
 let count = 0;
 const client = { runs: { stream: (_thread: string, _graph: string, options: unknown) => { count++; assert.deepEqual(options, { input: { messages: [{ role: "user", content: "hello" }] }, streamMode: ["messages-tuple", "values"], signal: undefined }); return []; } } } as unknown as Client;
 streamChatRun({ client, config: { apiUrl: "/api/langgraph", assistantId: "simple_llm", streamMode: "messages-tuple" }, threadId: "test", messages: [{ role: "user", content: "hello" }] });
 assert.equal(count, 1);
});

test("values-only agents retain their provider transport instead of implicitly enabling token streaming", () => {
 const client = { runs: { stream: (_thread: string, _graph: string, options: { streamMode: unknown }) => { assert.deepEqual(options.streamMode, ["values"]); return []; } } } as unknown as Client;
 streamChatRun({ client, config: { apiUrl: "/api/langgraph", assistantId: "technical_analysis_agent", streamMode: "values" }, threadId: "ta", messages: [{ role: "user", content: "bounded TA request" }] });
});
