import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ classify: vi.fn(), generate: vi.fn(), report: vi.fn() }));
vi.mock("@/reporting/intent-routing", () => ({ classifyIntent: mocks.classify }));
vi.mock("@openuidev/langchain", () => ({ createLangChainStreamResponse: mocks.generate }));
vi.mock("@/reporting/report-response", () => ({ createReportResponse: mocks.report }));
import { POST } from "./route";
const request = (messages: unknown = [{ role: "user", content: "그걸 보고서로 바꿔줘" }]) => new NextRequest("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages }) });

beforeEach(() => { vi.resetAllMocks(); mocks.generate.mockResolvedValue(new Response("chat-stream")); mocks.report.mockReturnValue(new Response("report-stream")); });
describe("model-routed chat API", () => {
  it("uses the general assistant for a model-selected chat even when the text mentions report", async () => {
    mocks.classify.mockResolvedValue({ mode: "chat", source: "none", sourceMessageId: null });
    const response = await POST(request());
    expect(response.headers.get("X-UI-Intent")).toBe("chat");
    expect(await response.text()).toBe("chat-stream");
    expect(mocks.generate.mock.calls[0][1].assistantId).toBe("agent");
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it("uses report generation and its separate assistant when the model selects report", async () => {
    const intent = { mode: "report", source: "none", sourceMessageId: null };
    mocks.classify.mockResolvedValue(intent);
    const response = await POST(request([{ role: "user", content: "짧은 요청" }]));
    expect(response.headers.get("X-UI-Intent")).toBe("report");
    expect(await response.text()).toBe("report-stream");
    const generate = mocks.report.mock.calls[0][2];
    await generate(request());
    expect(mocks.generate.mock.calls[0][1].assistantId).toBe("report");
    expect(mocks.report.mock.calls[0][3]).toEqual(intent);
  });
  it("does not generate when classification fails, and rejects malformed message lists", async () => {
    mocks.classify.mockRejectedValue(new Error("classifier unavailable"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.generate).not.toHaveBeenCalled();
    for (const messages of [null, [], [null], [{ role: "assistant", content: "only assistant" }]]) expect((await POST(request(messages))).status).toBe(400);
  });
});
