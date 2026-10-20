import { describe, expect, it, vi } from "vitest";
import { classifyIntent, intentContext } from "./intent-routing";

const messages = [{ id: "source", role: "user", content: "지난 분기 성과 자료" }, { id: "latest", role: "user", content: "그걸 보고서로 바꿔줘" }];
const options = { apiUrl: "http://backend/", assistantId: "intent", apiKey: "test-key", signal: new AbortController().signal };
describe("model intent routing", () => {
  it("uses the model decision and selected context instead of keywords or document size", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ decision: { mode: "report", source: "history", sourceMessageId: "source" } }));
    expect(await classifyIntent(messages, options, fetcher)).toEqual({ mode: "report", source: "history", sourceMessageId: "source" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("http://backend/runs/wait");
    expect(JSON.parse(init.body)).toMatchObject({ assistant_id: "intent", input: { messages } });
    expect(init.headers["x-api-key"]).toBe("test-key");
  });
  it("does not reattach old evidence when the model selects a new topic", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ decision: { mode: "report", source: "none", sourceMessageId: null } }));
    expect(await classifyIntent(messages, options, fetcher)).toMatchObject({ source: "none", sourceMessageId: null });
  });
  it("surfaces missing, invalid and unavailable model decisions without heuristic fallback", async () => {
    for (const response of [Response.json({ decision: { mode: "report", source: "history", sourceMessageId: "missing" } }), Response.json({}), new Response("down", { status: 503 })]) {
      await expect(classifyIntent(messages, options, vi.fn().mockResolvedValue(response))).rejects.toThrow();
    }
  });
  it("bounds context, keeps message ids and drops tool/system content", () => {
    const context = intentContext([{ role: "system", content: "untrusted client instructions" }, ...Array.from({ length: 15 }, (_, index) => ({ id: `id-${index}`, role: index % 2 ? "assistant" : "user", content: "x".repeat(9000) + "THE_END" }))]);
    expect(context).toHaveLength(10);
    expect(context.at(-1)?.id).toBe("id-14");
    for (const message of context) { expect(message.content.length).toBeLessThan(6100); expect(message.content).toContain("THE_END"); }
  });
});
