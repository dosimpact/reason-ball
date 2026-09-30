import { createServer } from "node:http";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { proxyLanguageModel } from "../../src/shared/api/ai/proxy-language-model";

test("buffered OAuth Responses JSON reaches the app as text deltas", async () => {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      id: "resp_test", object: "response", status: "completed", model: "gpt-5.6-terra",
      output: [{ type: "message", role: "assistant", id: "msg_test", content: [{ type: "output_text", text: "Hello!", annotations: [] }] }],
      usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 },
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server address is unavailable.");
    const openai = createOpenAI({ baseURL: `http://127.0.0.1:${address.port}/v1`, apiKey: "test-token" });
    const result = streamText({
      model: proxyLanguageModel(openai.responses("gpt-5.6-terra")),
      prompt: "Say hello.",
      maxRetries: 0,
      providerOptions: { openai: { store: false } },
    });
    const parts = [];
    for await (const part of result.fullStream) parts.push(part);
    expect(parts.filter((part) => part.type === "text-delta").map((part) => part.text).join("")).toBe("Hello!");
    expect(parts.some((part) => part.type === "finish" && part.finishReason === "stop")).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: "gpt-5.6-terra", store: false });
    expect(requests[0].stream).not.toBe(true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("buffered proxy responses preserve reasoning and pending tool calls", async () => {
  const server = createServer(async (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      id: "resp_tool", object: "response", status: "completed", model: "gpt-5.6-terra",
      output: [
        { type: "reasoning", id: "reason_1", summary: [{ type: "summary_text", text: "Need weather data." }] },
        { type: "function_call", id: "call_item_1", call_id: "call_1", name: "weather", arguments: '{"location":"Seoul"}' },
      ],
      usage: { input_tokens: 5, output_tokens: 4, total_tokens: 9 },
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server address is unavailable.");
    const openai = createOpenAI({ baseURL: `http://127.0.0.1:${address.port}/v1`, apiKey: "test-token" });
    const result = streamText({
      model: proxyLanguageModel(openai.responses("gpt-5.6-terra")), prompt: "Weather?", maxRetries: 0,
      tools: { weather: tool({ inputSchema: z.object({ location: z.string() }), needsApproval: true, execute: async () => ({ temperature: 20 }) }) },
    });
    const parts = [];
    for await (const part of result.fullStream) parts.push(part);
    expect(parts.some((part) => part.type === "reasoning-delta" && part.text === "Need weather data.")).toBe(true);
    expect(parts.some((part) => part.type === "tool-call" && part.toolName === "weather" && JSON.stringify(part.input) === '{"location":"Seoul"}')).toBe(true);
    expect(parts.some((part) => part.type === "tool-approval-request")).toBe(true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("proxy provider errors remain errors instead of empty successful replies", async () => {
  const openai = createOpenAI({
    baseURL: "http://proxy.invalid/v1", apiKey: "test-token",
    fetch: async () => new Response(JSON.stringify({ error: { message: "upstream failed", type: "upstream_error", code: "upstream_error" } }), {
      status: 502, headers: { "Content-Type": "application/json" },
    }),
  });
  const result = streamText({ model: proxyLanguageModel(openai.responses("gpt-5.6-terra")), prompt: "Say hello.", maxRetries: 0, onError: () => {} });
  const parts = [];
  for await (const part of result.fullStream) parts.push(part);
  expect(parts.some((part) => part.type === "error")).toBe(true);
  expect(parts.some((part) => part.type === "text-delta")).toBe(false);
});

test("aborting buffered proxy generation aborts the upstream request", async () => {
  let markFetchStarted: (() => void) | undefined;
  const fetchStarted = new Promise<void>((resolve) => { markFetchStarted = resolve; });
  const observed: { signal?: AbortSignal } = {};
  const openai = createOpenAI({
    baseURL: "http://proxy.invalid/v1", apiKey: "test-token",
    fetch: async (_url, init) => {
      observed.signal = init?.signal ?? undefined;
      markFetchStarted?.();
      return new Promise<Response>((_resolve, reject) => {
        observed.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    },
  });
  const controller = new AbortController();
  const result = streamText({ model: proxyLanguageModel(openai.responses("gpt-5.6-terra")), prompt: "Say hello.", abortSignal: controller.signal, maxRetries: 0 });
  const consume = (async () => {
    const parts = [];
    try { for await (const part of result.fullStream) parts.push(part); }
    catch { /* An aborted stream may reject during iteration. */ }
    return parts;
  })();
  await fetchStarted;
  controller.abort();
  const parts = await consume;
  expect(observed.signal?.aborted).toBe(true);
  expect(parts.some((part) => part.type === "text-delta")).toBe(false);
});
