import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { exampleGeneralReport, exampleVendorReport } from "./prompt-options";
import { createReportResponse } from "./report-response";
import { buildVendorReport } from "./vendor-report";

const body = { messages: [{ id: "source", role: "user", content: "[문서 보고서 생성] 원문" }] };
const request = () => new NextRequest("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) });
function generated(program: string) {
  const events = [{ type: "TEXT_MESSAGE_CONTENT", delta: program }, { type: "RUN_FINISHED" }];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
}
const eventsOf = (text: string) => text.split("\n").filter((line) => line.startsWith("data:")).map((line) => JSON.parse(line.slice(5)));
const vendorSource = `# 공급업체 테스트
| 지표 | W1 | W2 | 변화 |
|---|---|---|---|
| 광고 매출 | 100원 | 120원 | +15원 |
| 광고비 | 50원 | 60원 | +10원 |
| 광고수익률 | 200% | 200% | 0%p |
| 전환율 | 4% | 3% | -1%p |
### 섹션 3A
| 캠페인명 | 캠페인 ID | 이후 광고 매출 | 광고수익률 | 목표 광고수익률 |
|---|---|---|---|---|
| 주력 | CAMP_001 | 120원 | 200% | 180% |
### 섹션 7B
| VID | 상품명 | 적격 상태 / 이슈 | 이슈 근거 / 시간 | 최근 2주 광고 매출 영향 / 위험 |
|---|---|---|---|---|
| VID_001 | 상품 | 품절 | 최근 2주간 47시간 | 20원 |`;

describe("validated report delivery", () => {
  it("repairs a table-only answer before exposing or saving any assistant text", async () => {
    const generate = vi.fn().mockResolvedValueOnce(generated('root = Col([Text("broken")])')).mockResolvedValueOnce(generated(exampleVendorReport));
    const response = createReportResponse(request(), body, generate);
    const events = eventsOf(await response.text());
    expect(generate).toHaveBeenCalledTimes(2);
    expect(events.filter((event) => event.type === "TEXT_MESSAGE_CONTENT").map((event) => event.delta)).toEqual([exampleVendorReport]);
    expect(events.at(-1).type).toBe("RUN_FINISHED");
    expect(response.headers.get("Content-Type")).toContain("charset=utf-8");
    const retry = await (generate.mock.calls[1][0] as NextRequest).json();
    expect(retry.messages[0]).toEqual(body.messages[0]);
    expect(retry.messages.at(-1).content).toContain("Card");
  });

  it("stops after a bounded repair and reports failure without a partial report", async () => {
    const generate = vi.fn().mockResolvedValue(generated('root = Col([Text("broken")])'));
    const events = eventsOf(await createReportResponse(request(), body, generate).text());
    expect(generate).toHaveBeenCalledTimes(2);
    expect(events.at(-1).type).toBe("RUN_ERROR");
    expect(events.some((event) => event.type === "TEXT_MESSAGE_CONTENT" || event.type === "RUN_FINISHED")).toBe(false);
  });

  it("surfaces provider failure instead of pretending generation finished", async () => {
    const generate = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const events = eventsOf(await createReportResponse(request(), body, generate).text());
    expect(generate).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toMatchObject({ type: "RUN_ERROR", message: expect.stringContaining("503") });
  });

  it("keeps source charts and every source cell even when report commentary fails", async () => {
    const sourceBody = { messages: [{ role: "user", content: vendorSource }] };
    const generate = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const events = eventsOf(await createReportResponse(request(), sourceBody, generate).text());
    expect(events.find((event) => event.type === "CUSTOM")?.value.strategy).toBe("source_scaffold");
    expect(events.at(-1).type).toBe("RUN_FINISHED");
    const program = events.find((event) => event.type === "TEXT_MESSAGE_CONTENT").delta;
    expect(program).toContain("AI 해설을 불러오지 못해");
    expect(program).toContain('"hours":47');
    expect(program).toContain("+15원");
    expect(program).toContain("120원");
  });

  it("only inserts validated commentary, leaving the source-derived data intact", async () => {
    const generate = vi.fn().mockResolvedValue(generated('root = Col([Card([Title("핵심 해석", "md"), Text("원문 지표 확인", "sm")])])'));
    const events = eventsOf(await createReportResponse(request(), { messages: [{ role: "user", content: vendorSource }] }, generate).text());
    expect(events.find((event) => event.type === "CUSTOM")?.value.strategy).toBe("source_scaffold_with_ai");
    expect(events.find((event) => event.type === "TEXT_MESSAGE_CONTENT").delta).toContain("aiInsights =");
    expect(await (generate.mock.calls[0][0] as NextRequest).json()).toMatchObject({ messages: [{ content: expect.stringContaining("[보고서 해설 생성]") }] });
  });

  it("generates a general report without forcing vendor controls or reusing unrelated vendor history", async () => {
    const generate = vi.fn().mockResolvedValue(generated(exampleGeneralReport));
    const messages = [{ id: "old", role: "user", content: vendorSource }, { id: "new", role: "user", content: "리스본 여행 검토 보고서를 작성해줘" }];
    const events = eventsOf(await createReportResponse(request(), { messages }, generate, { mode: "report", source: "none", sourceMessageId: null }).text());
    expect(events.find(event => event.type === "CUSTOM")?.value.strategy).toBe("model_report");
    expect(events.find(event => event.type === "TEXT_MESSAGE_CONTENT")?.delta).toBe(exampleGeneralReport);
    expect((await (generate.mock.calls[0][0] as NextRequest).json()).messages).toEqual(messages);
  });

  it("recovers the preserved source when the model selects a previous compiled vendor report", async () => {
    const generate = vi.fn().mockResolvedValue(generated('root = Col([Card([Title("핵심 해석", "md"), Text("원문 지표 확인", "sm")])])'));
    const messages = [{ id: "answer", role: "assistant", content: buildVendorReport(vendorSource) }, { role: "user", content: "앞 보고서를 다시 작성해줘" }];
    const events = eventsOf(await createReportResponse(request(), { messages }, generate, { mode: "report", source: "history", sourceMessageId: "answer" }).text());
    expect(events.find(event => event.type === "CUSTOM")?.value.strategy).toBe("source_scaffold_with_ai");
    const program = events.find(event => event.type === "TEXT_MESSAGE_CONTENT")?.delta;
    expect(program).toContain('"hours":47');
    expect(program).toContain("120원");
  });
});
