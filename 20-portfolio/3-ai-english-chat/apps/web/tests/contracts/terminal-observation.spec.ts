import { expect, test } from "@playwright/test";
import { streamText, toUIMessageStream, type UIMessageChunk } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { createTerminalObservation, type TerminalOutcome } from "../../src/app/api/ai/chat/_lib/terminal-observation";
import { gatePersistedStream } from "../../src/app/api/ai/chat/_lib/persisted-stream";

async function drain(stream: ReadableStream<UIMessageChunk>) {
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  while (true) { const item = await reader.read(); if (item.done) return chunks; chunks.push(item.value); }
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
type ProviderStreamPart = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer Part> ? Part : never;

function model(fail = false) {
  return new MockLanguageModelV4({ doStream: async () => ({
    stream: simulateReadableStream<ProviderStreamPart>({ initialDelayInMs: null, chunkDelayInMs: null, chunks: fail ? [
      { type: "stream-start", warnings: [] }, { type: "error", error: new Error("private provider diagnostic") },
    ] : [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "text" }, { type: "text-delta", id: "text", delta: "Hello" }, { type: "text-end", id: "text" },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 },
      } },
    ] }),
  }) });
}

test("SDK model completion emits no success until final persistence settles", async () => {
  const records: TerminalOutcome[] = [];
  const observation = createTerminalObservation(value => records.push(value));
  const persistence = deferred(); const entered = deferred();
  let usageSeen = false;
  const result = streamText({ model: model(), prompt: "Hello", onFinish: () => { usageSeen = true; } });
  const source = toUIMessageStream({ stream: result.stream, onEnd: async ({ outcome }) => {
    expect(outcome.status).toBe("completed"); entered.resolve();
    await observation.persist("success", () => persistence.promise);
  } });
  const consumed = drain(gatePersistedStream(source, () => observation.record("error")));
  await entered.promise;
  expect(usageSeen).toBe(true); expect(records).toEqual([]);
  persistence.resolve();
  const chunks = await consumed;
  expect(chunks.at(-1)?.type).toBe("finish");
  expect(records).toEqual(["success"]);
});

test("a model success followed by failed storage records only error and suppresses the finish marker", async () => {
  const records: TerminalOutcome[] = [];
  const observation = createTerminalObservation(value => records.push(value));
  const result = streamText({ model: model(), prompt: "Hello" });
  const source = toUIMessageStream({ stream: result.stream, onEnd: async () => {
    await observation.persist("success", async () => { throw new Error("private storage diagnostic"); });
  }, onError: () => "Safe failure" });
  const chunks = await drain(gatePersistedStream(source, () => observation.record("error")));
  expect(records).toEqual(["error"]);
  expect(chunks.some(chunk => chunk.type === "finish")).toBe(false);
  expect(JSON.stringify(chunks)).not.toContain("private storage diagnostic");
});

test("SDK provider error still reaches onEnd and records error once after saving its failure state", async () => {
  const events: string[] = [];
  const observation = createTerminalObservation(value => events.push(value));
  let failed = false;
  const result = streamText({ model: model(true), prompt: "Hello", maxRetries: 0,
    onError: () => { failed = true; },
  });
  const source = toUIMessageStream({ stream: result.stream, onError: () => "Safe provider failure", onEnd: async ({ outcome }) => {
    // An error chunk does not guarantee a non-completed UI outcome in this SDK.
    expect(failed).toBe(true);
    const status = !failed && outcome.status === "completed" ? "success" : "error";
    await observation.persist(status, async () => { events.push(`saved-${status}`); });
  } });
  await drain(gatePersistedStream(source, () => observation.record("error")));
  expect(events).toEqual(["saved-error", "error"]);
});

test("abort observation waits for cancelled state persistence and a duplicate fallback cannot overwrite it", async () => {
  const records: TerminalOutcome[] = [];
  const observation = createTerminalObservation(value => records.push(value));
  const save = deferred();
  const cancelled = observation.persist("aborted", () => save.promise);
  expect(records).toEqual([]);
  save.resolve(); await cancelled;
  observation.record("error"); observation.record("success");
  expect(records).toEqual(["aborted"]);
});

test("failed cancellation persistence is error rather than a falsely saved abort", async () => {
  const records: TerminalOutcome[] = [];
  const observation = createTerminalObservation(value => records.push(value));
  await expect(observation.persist("aborted", async () => { throw new Error("db unavailable"); })).rejects.toThrow("db unavailable");
  observation.record("aborted"); expect(records).toEqual(["error"]);
});

test("an early rejected request has one terminal observation without generation or provider completion", () => {
  const records: TerminalOutcome[] = [];
  const observation = createTerminalObservation(value => records.push(value));
  observation.record("error"); observation.record("error");
  expect(records).toEqual(["error"]);
});

test("consumer cancellation during a pending read waits for saved abort without a false gate error", async () => {
  const records: TerminalOutcome[] = [];
  const observation = createTerminalObservation(value => records.push(value));
  const entered = deferred();
  const saved = deferred();
  const source = new ReadableStream<UIMessageChunk>({
    async cancel() {
      entered.resolve();
      await observation.persist("aborted", () => saved.promise);
    },
  });
  const reader = gatePersistedStream(source, () => observation.record("error")).getReader();
  const pendingRead = reader.read();
  // Let the output pull start its source read before cancelling downstream.
  await Promise.resolve();
  const cancelled = reader.cancel("navigation");
  await entered.promise;
  await pendingRead;
  expect(records).toEqual([]);
  saved.resolve();
  await cancelled;
  expect(records).toEqual(["aborted"]);
});

test("consumer cancellation still records a genuine cancellation persistence failure", async () => {
  const records: TerminalOutcome[] = [];
  const observation = createTerminalObservation(value => records.push(value));
  const source = new ReadableStream<UIMessageChunk>({
    async cancel() {
      await observation.persist("aborted", async () => { throw new Error("storage unavailable"); });
    },
  });
  const reader = gatePersistedStream(source, () => observation.record("error")).getReader();
  const pendingRead = reader.read();
  await Promise.resolve();
  await expect(reader.cancel("navigation")).rejects.toThrow("storage unavailable");
  await pendingRead;
  expect(records).toEqual(["error"]);
});
