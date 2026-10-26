import { describe, expect, it } from "vitest";
import { reduceReport, type Report } from "./state";
import { consumeSse } from "./stream";
const first: Report = { id: "old", title: "Report", vendor: "supplier", source_file: "source.md", program: "old content", status: "ready", published: false, created_at: "now" };

describe("Canvas revision boundaries", () => {
  it("replaces the report, ignores stale deltas, and resets text for a repair", () => {
    const fresh = { ...first, id: "new", program: "", status: "generating" as const };
    let report = reduceReport(first, { channel: "canvas", type: "open", report: fresh });
    expect(report).toEqual(fresh);
    report = reduceReport(report, { channel: "canvas", type: "TEXT_MESSAGE_CONTENT", reportId: "old", delta: "stale" });
    expect(report?.program).toBe("");
    report = reduceReport(report, { channel: "canvas", type: "TEXT_MESSAGE_CONTENT", reportId: "new", delta: "root = " });
    expect(report?.program).toBe("root = ");
    report = reduceReport(report, { channel: "canvas", type: "TEXT_MESSAGE_START", reportId: "new" });
    expect(report?.program).toBe("");
    expect(reduceReport(report, { channel: "canvas", type: "ready", report: first })).toBe(report);
  });
  it("does not create a report from a delta without an open event", () => {
    expect(reduceReport(null, { channel: "canvas", type: "TEXT_MESSAGE_CONTENT", delta: "orphan" })).toBeNull();
  });
});

describe("SSE transport", () => {
  it("decodes Korean UTF-8, CRLF, subgraph event names and split frames one byte at a time", async () => {
    const bytes = new TextEncoder().encode('event: custom|report_subagent:1\r\ndata: {"channel":"canvas","type":"TEXT_MESSAGE_CONTENT","delta":"공급업체"}\r\n\r\nevent: end\r\ndata: null\r\n\r\n');
    const stream = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
    const events: unknown[] = [];
    await consumeSse(new Response(stream), (name, data) => events.push([name, data]));
    expect(events).toEqual([["custom|report_subagent:1", { channel: "canvas", type: "TEXT_MESSAGE_CONTENT", delta: "공급업체" }], ["end", null]]);
  });
  it("rejects an interrupted frame", async () => {
    await expect(consumeSse(new Response('event: custom\ndata: {"type":'), () => {})).rejects.toThrow("끊겼습니다");
  });
});
