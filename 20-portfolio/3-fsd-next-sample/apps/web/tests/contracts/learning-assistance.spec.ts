import { expect, test } from "@playwright/test";
import { assistanceRequestSchema, assistanceResultSchema, buildAssistancePrompt, selectAssistanceContext, type AssistanceMessage } from "../../src/entities/learning-assistance/model/assistance";
import { requestAssistance } from "../../src/entities/learning-assistance/api/client";

const messages: AssistanceMessage[] = [{ id: "a", role: "assistant", text: "What would you like?" }, { id: "u", role: "user", text: "I wants coffee." }, { id: "later", role: "assistant", text: "Future response" }];
test("assistance context is bound to one message and never includes later turns", () => {
  const before = structuredClone(messages);
  const context = selectAssistanceContext(messages, "u", "correction");
  expect(context.target.text).toBe("I wants coffee.");
  expect(context.history).toEqual([messages[0]]);
  const prompt = JSON.parse(buildAssistancePrompt("correction", "A1", context));
  expect(prompt).toMatchObject({ mode: "correction", level: "A1", target: messages[1] });
  expect(messages).toEqual(before);
});
test("assistance rejects wrong roles, missing IDs, duplicate IDs and unsupported levels", () => {
  expect(() => selectAssistanceContext(messages, "a", "correction")).toThrow();
  expect(() => selectAssistanceContext(messages, "u", "reply")).toThrow();
  expect(() => selectAssistanceContext(messages, "missing", "rephrase")).toThrow();
  expect(() => selectAssistanceContext([...messages, messages[0]], "a", "reply")).toThrow();
  expect(() => buildAssistancePrompt("reply", "invalid", selectAssistanceContext(messages, "a", "reply"))).toThrow();
  expect(assistanceRequestSchema.safeParse({ conversationId: "c", messageId: "u", mode: "correction", ownerId: "forged" }).success).toBe(false);
  expect(assistanceResultSchema.safeParse({ suggestion: "", brief: "ok", explanation: "ok" }).success).toBe(false);
});
test("assistance HTTP keeps the request on retry and rejects mismatched or failed replies", async () => {
  const request = { conversationId: "c", messageId: "u", mode: "correction" as const };
  const bodies: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    bodies.push(String(init?.body));
    return bodies.length === 1 ? new Response("{}", { status: 503 }) : Response.json({ mode: "correction", messageId: "u", targetText: "I wants coffee.", source: "mock", result: { suggestion: "I want coffee.", brief: "짧은 교정", explanation: "설명" } });
  };
  await expect(requestAssistance(request, undefined, fetcher)).rejects.toThrow();
  expect((await requestAssistance(request, undefined, fetcher)).result.suggestion).toBe("I want coffee.");
  expect(bodies[0]).toBe(bodies[1]);
  await expect(requestAssistance(request, undefined, async () => Response.json({ mode: "reply", messageId: "other", targetText: "Other", source: "mock", result: { suggestion: "x", brief: "x", explanation: "x" } }))).rejects.toThrow("다른 메시지");
});
