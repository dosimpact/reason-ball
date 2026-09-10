import { expect, test } from "@playwright/test";
import { streamText, toUIMessageStream, type TextStreamPart, type UIMessageChunk } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { gatePersistedStream } from "../../src/app/api/ai/chat/_lib/persisted-stream";

function providerStream() {
  return new ReadableStream<TextStreamPart<Record<string, never>>>({
    start(controller) {
      controller.enqueue({ type: "text-start", id: "text-1" });
      controller.enqueue({ type: "text-delta", id: "text-1", text: "Hello!" });
      controller.enqueue({ type: "text-end", id: "text-1" });
      controller.enqueue({
        type: "finish", finishReason: "stop", rawFinishReason: "stop",
        totalUsage: {
          inputTokens: 1, outputTokens: 1, totalTokens: 2,
          inputTokenDetails: { noCacheTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
          outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
        },
      });
      controller.close();
    },
  });
}

test("releases the success marker only after async persistence completes", async () => {
  let release!: () => void;
  const saved = new Promise<void>((resolve) => { release = resolve; });
  let entered!: () => void;
  const saving = new Promise<void>((resolve) => { entered = resolve; });
  const source = toUIMessageStream({
    stream: providerStream(),
    onEnd: async ({ responseMessage }) => {
      expect(responseMessage.parts).toEqual([{ type: "text", text: "Hello!", state: "done" }]);
      entered();
      await saved;
    },
  });
  const received: UIMessageChunk[] = [];
  let ended = false;
  const consuming = (async () => {
    const reader = gatePersistedStream(source).getReader();
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      received.push(item.value);
    }
    ended = true;
  })();
  await saving;
  expect(ended).toBe(false);
  expect(received.some((chunk) => chunk.type === "finish")).toBe(false);
  expect(received.some((chunk) => chunk.type === "text-delta")).toBe(true);
  release();
  await consuming;
  expect(ended).toBe(true);
  expect(received.at(-1)?.type).toBe("finish");
});

test("does not forward finish when persistence fails", async () => {
  const source = new ReadableStream<UIMessageChunk>({
    async start(controller) {
      controller.enqueue({ type: "start", messageId: "assistant-1" });
      controller.enqueue({ type: "finish", finishReason: "stop" });
      await Promise.resolve();
      controller.error(new Error("private database diagnostic"));
    },
  });
  const reader = gatePersistedStream(source).getReader();
  const chunks: UIMessageChunk[] = [];
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    chunks.push(item.value);
  }
  expect(chunks.some((chunk) => chunk.type === "finish")).toBe(false);
  expect(chunks.at(-1)?.type).toBe("error");
  expect(JSON.stringify(chunks)).not.toContain("private database diagnostic");
});

test("forwards finish after a successful source closes and accepts an empty stream", async () => {
  for (const chunks of [[], [{ type: "finish", finishReason: "stop" }]] as UIMessageChunk[][]) {
    const reader = gatePersistedStream(new ReadableStream<UIMessageChunk>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    })).getReader();
    const received: UIMessageChunk[] = [];
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      received.push(item.value);
    }
    expect(received).toEqual(chunks);
  }
});

test("propagates consumer cancellation to the source", async () => {
  let cancellation: unknown;
  const source = new ReadableStream<UIMessageChunk>({ cancel(reason) { cancellation = reason; } });
  await gatePersistedStream(source).cancel("navigation");
  expect(cancellation).toBe("navigation");
});

test("AI SDK completion supplies the persisted assistant ID and a completed outcome", async () => {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ initialDelayInMs: null, chunkDelayInMs: null, chunks: [
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: "Hello!" },
        { type: "text-end", id: "text-1" },
        { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        } },
      ] }),
    }),
  });
  const result = streamText({ model, prompt: "Hello", maxRetries: 0 });
  let outcomeStatus: string | undefined;
  let responseId: string | undefined;
  const source = toUIMessageStream({
    stream: result.stream,
    generateMessageId: () => "saved-assistant-id",
    onEnd: ({ outcome, responseMessage }) => {
      outcomeStatus = outcome.status;
      responseId = responseMessage.id;
    },
  });
  const reader = gatePersistedStream(source).getReader();
  let last: UIMessageChunk | undefined;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    last = next.value;
  }
  expect(outcomeStatus).toBe("completed");
  expect(responseId).toBe("saved-assistant-id");
  expect(last?.type).toBe("finish");
});
