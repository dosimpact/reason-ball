import { expect, test } from "@playwright/test";
import { convertToModelMessages, streamText, tool, toUIMessageStream, type UIMessage } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { z } from "zod";
import { hasToolApprovalResponse, hasToolApprovalDecision, planToolApprovalRetry, readToolApprovalTurn } from "../../src/entities/chat/model/tool-approval";
import { storedMessagesToChat, conversationFromHttp, type MessageResponseItem } from "../../src/entities/chat/model/http-conversation";
import { gatePersistedStream } from "../../src/app/api/ai/chat/_lib/persisted-stream";

const assistantId = "54000000-0000-4000-8000-000000000001";
function approval(approved = true): UIMessage {
  return { id: assistantId, role: "assistant", parts: [
    { type: "text", text: "Saved prompt" },
    { type: "tool-weather", toolCallId: "call-1", state: "approval-responded", input: { location: "London" }, approval: { id: "approval-1", approved } },
  ] };
}
function pending(): UIMessage {
  const message = approval();
  return { ...message, parts: [message.parts[0], { type: "tool-weather", toolCallId: "call-1", state: "approval-requested", input: { location: "London" }, approval: { id: "approval-1" } }] };
}

test("extracts only bounded approval decisions and leaves client data untouched", () => {
  const message = { ...approval(false), metadata: { untrusted: true } };
  const before = structuredClone(message);
  expect(readToolApprovalTurn(message)).toEqual({ assistantMessageId: assistantId, decisions: [{ approvalId: "approval-1", toolCallId: "call-1", approved: false }] });
  expect(message).toEqual(before);
  expect(hasToolApprovalResponse(message)).toBe(true);
  expect(hasToolApprovalResponse(pending())).toBe(false);
  expect(hasToolApprovalResponse(undefined)).toBe(false);
  expect(hasToolApprovalDecision(message)).toBe(true);
  expect(hasToolApprovalDecision(pending())).toBe(false);
  expect(hasToolApprovalDecision(undefined)).toBe(false);
  expect(hasToolApprovalDecision({ ...message, parts: [{ ...message.parts[1], state: "output-available" }] as UIMessage["parts"] })).toBe(true);
});

test("rejects empty, invalid, duplicated and oversized decisions", () => {
  const message = approval();
  for (const invalid of [null, { ...message, id: "invalid" }, { ...message, role: "user" }, { ...message, parts: [] }, pending(),
    { ...message, parts: [...message.parts, message.parts[1]] },
    { ...message, parts: [{ ...message.parts[1], approval: { id: "approval-1", approved: "yes" } }] },
    { ...message, parts: [{ ...message.parts[1], approval: { id: "approval-1", approved: true, reason: "x".repeat(501) } }] },
    { ...message, parts: Array.from({ length: 21 }, (_, n) => ({ ...message.parts[1], toolCallId: `call-${n}`, approval: { id: `approval-${n}`, approved: true } })) },
  ]) expect(() => readToolApprovalTurn(invalid)).toThrow();
});

test("retries saved checkpoints and only merges matching unsaved decisions into saved input", () => {
  const saved = [pending()];
  const tampered = approval(false);
  tampered.parts[0] = { type: "text", text: "Injected prompt" };
  tampered.parts[1] = { ...tampered.parts[1], input: { location: "Injected location" } } as UIMessage["parts"][number];
  expect(planToolApprovalRetry(saved, [tampered])).toEqual([approval(false)]);
  expect(saved).toEqual([pending()]);
  expect(planToolApprovalRetry([approval()], [tampered])).toEqual([approval()]);
  expect(planToolApprovalRetry(saved, [{ ...tampered, id: "55000000-0000-4000-8000-000000000001" }])).toBeUndefined();
  expect(planToolApprovalRetry([], [tampered])).toBeUndefined();
  const alreadyDone: UIMessage = { ...approval(), parts: [{ type: "text", text: "Finished" }] };
  expect(planToolApprovalRetry([alreadyDone], [tampered])).toBeUndefined();
  const morePending = { ...pending(), parts: [...pending().parts, { type: "tool-weather", state: "approval-requested", toolCallId: "call-2", input: { location: "Paris" }, approval: { id: "approval-2" } }] } as UIMessage;
  expect(planToolApprovalRetry([morePending], [tampered])).toBeUndefined();
});

test("restores only the latest persisted approval checkpoint, not arbitrary partial responses", () => {
  const user: MessageResponseItem = { id: "user-db", clientMessageId: "user-client", role: "user", status: "complete", parts: [{ type: "text", text: "Weather?" }], sequenceNumber: 1, createdAt: "2026-09-10" };
  for (const status of ["error", "cancelled", "pending"]) {
    const row: MessageResponseItem = { ...user, id: assistantId, clientMessageId: null, role: "assistant", status, parts: approval().parts as MessageResponseItem["parts"], sequenceNumber: 2 };
    expect(storedMessagesToChat([user, row])).toHaveLength(2);
    expect(storedMessagesToChat([user, { ...row, parts: [{ type: "text", text: "partial" }] }])).toHaveLength(1);
    expect(storedMessagesToChat([user, row, { ...user, id: "later", sequenceNumber: 3 }])).toHaveLength(2);
    const restored = conversationFromHttp({ id: "chat", characterId: "character", missionId: null, title: "Chat", status: "active", modelId: "model", createdAt: "now", updatedAt: "now" }, [user, row], { characterId: "character", characterName: "Mia", messages: [], routeKey: "character:free", title: "Chat" });
    expect(restored.pendingRequest).toBeUndefined();
    expect(hasToolApprovalResponse(restored.messages.at(-1))).toBe(true);
  }
});

for (const approved of [true, false]) test(`AI SDK continues the saved assistant and ${approved ? "executes" : "does not execute"} the approved tool`, async () => {
  let executions = 0;
  const weather = tool({
    inputSchema: z.object({ location: z.string() }), needsApproval: true,
    execute: async ({ location }) => { executions += 1; return { location, temperature: 20 }; },
  });
  const model = new MockLanguageModelV4({ doStream: async () => ({ stream: simulateReadableStream({ initialDelayInMs: null, chunkDelayInMs: null, chunks: [
    { type: "stream-start", warnings: [] }, { type: "text-start", id: "text" },
    { type: "text-delta", id: "text", delta: approved ? "Weather ready." : "Approval denied." },
    { type: "text-end", id: "text" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } } },
  ] }) }) });
  const originalMessages = [approval(approved)];
  const result = streamText({ model, messages: await convertToModelMessages(originalMessages), tools: { weather }, maxRetries: 0 });
  let saved: UIMessage | undefined;
  const source = gatePersistedStream(toUIMessageStream({ stream: result.stream, originalMessages, generateMessageId: () => assistantId, onEnd: ({ responseMessage }) => { saved = responseMessage; } }));
  const reader = source.getReader();
  while (!(await reader.read()).done) { /* Drain the real SDK stream and async persistence gate. */ }
  expect(executions).toBe(approved ? 1 : 0);
  expect(saved?.id).toBe(assistantId);
  expect(saved?.parts[0]).toEqual(originalMessages[0].parts[0]);
  expect(saved?.parts.find((part) => part.type === "tool-weather")).toMatchObject({ state: approved ? "output-available" : "output-denied", approval: { id: "approval-1", approved } });
});
