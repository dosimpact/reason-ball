import { afterEach, describe, expect, it, vi } from "vitest";
import { createParser, createQueryManager } from "@openuidev/lang-core";
import { OpenuiSystemPromptSpec as spec } from "@/shared/config";
import { fetchTechnicalAnalysisChart } from "./query-tools";

afterEach(() => vi.unstubAllGlobals());
describe("financial Query bridge", () => {
  it("validates Query with reactive args and refresh interval against the generated catalog", () => {
    const parsed = createParser(spec.schema, spec.root).parse('$ticker = "AAPL"\n$chart_refresh_seconds = 0\ndata = Query("technical_analysis_chart", {ticker:$ticker, interval:"1d", count:120}, {bars:[]}, $chart_refresh_seconds)\nroot = Col([FinancialChart(data)])');
    expect(parsed.meta.errors).toEqual([]);
    expect(parsed.meta.unresolved).toEqual([]);
    expect(parsed.meta.incomplete).toBe(false);
    expect(parsed.root).toBeTruthy();
  });
  it("keeps A→B→A current and ignores a late B response", async () => {
    const pending = new Map<string, (value: unknown) => void>();
    const manager = createQueryManager({ callTool: async (_name, args) => new Promise(resolve => pending.set(String(args.ticker), resolve)) });
    const query = (ticker: string) => ({ statementId: "chart", toolName: "technical_analysis_chart", args: { ticker }, defaults: { bars: [] }, deps: ticker, complete: true });
    try {
      manager.activate();
      manager.evaluateQueries([query("A")]);
      await Promise.resolve();
      manager.evaluateQueries([query("B")]);
      await Promise.resolve();
      manager.evaluateQueries([query("A")]);
      pending.get("A")?.({ symbol: "A", bars: [] });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(manager.getResult("chart")).toMatchObject({ symbol: "A" });
      pending.get("B")?.({ symbol: "B", bars: [] });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(manager.getResult("chart")).toMatchObject({ symbol: "A" });
    } finally { manager.dispose(); }
  });
  it("passes approved args through the Host proxy and preserves warmup nulls", async () => {
    const snapshot = { bars: [{ time: "2026-11-01", open: 1, high: 3, low: 1, close: 2, volume: 10, rsi: null }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot)));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchTechnicalAnalysisChart({ ticker: "AAPL", interval: "1w", count: 50 });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/langgraph/technical-analysis/chart?ticker=AAPL&interval=1w&count=50");
    expect(result.bars[0].rsi).toBeNull();
  });
  it("rejects API failures and disallows unknown arguments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(fetchTechnicalAnalysisChart({ ticker: "AAPL" })).rejects.toThrow("503");
    await expect(fetchTechnicalAnalysisChart({ url: "https://example.com" })).rejects.toThrow("Invalid chart argument");
  });
  it("passes cancellation to the network request", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      expect(init.signal).toBe(controller.signal);
      throw new DOMException("Aborted", "AbortError");
    }));
    controller.abort();
    await expect(fetchTechnicalAnalysisChart({ ticker: "AAPL" }, controller.signal)).rejects.toThrow("Aborted");
  });
});
