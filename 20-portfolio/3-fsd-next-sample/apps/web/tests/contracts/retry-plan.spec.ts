import { expect, test } from "@playwright/test";
import { planChatRetry } from "../../src/widgets/chat-workspace/model/retry-plan";
import type { ChatMessage } from "../../src/entities/chat/model/types";

const user: ChatMessage = { id: "user-1", role: "user", parts: [{ type: "text", text: "Hello" }] };
const answer: ChatMessage = { id: "answer-1", role: "assistant", parts: [{ type: "text", text: "Hi" }] };
const nextUser: ChatMessage = { id: "user-2", role: "user", parts: [{ type: "text", text: "Not saved yet" }] };

test("restores the response to the exact pending user turn without another AI call", () => {
  expect(planChatRetry([user, answer], [user], user.id)).toEqual({ kind: "restore", messages: [user, answer] });
});

test("preserves an unsaved new turn even when an older answer is stored", () => {
  const current = [user, answer, nextUser];
  const before = structuredClone(current);
  expect(planChatRetry([user, answer], current, nextUser.id)).toEqual({ kind: "send", history: [user, answer], userMessage: nextUser });
  expect(current).toEqual(before);
});

test("retries the same persisted user and drops only the local partial assistant", () => {
  expect(planChatRetry([user], [user, answer], user.id)).toEqual({ kind: "send", history: [], userMessage: user });
});

test("rejects an older unfinished turn when another user turn was appended", () => {
  expect(() => planChatRetry([user, nextUser], [user], user.id)).toThrow("다른 메시지");
  expect(() => planChatRetry([user, nextUser, answer], [user], user.id)).toThrow("다른 메시지");
});

test("handles an empty conversation and reports a missing pending message", () => {
  expect(planChatRetry([], [])).toEqual({ kind: "restore", messages: [] });
  expect(() => planChatRetry([], [], "missing")).toThrow("재전송할 메시지");
});
