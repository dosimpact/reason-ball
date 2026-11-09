import { describe, expect, it, vi } from "vitest";
import { readOutput } from "./stream";

const output = { program: 'root = Col([Text("분석")]);', controls: 'root = Col([Button("조회", @BusinessAction("search_sales", {region: "all"}))]);', revision: 1 };
function response(events: unknown[]) { return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join("")); }
const result = { type: "CUSTOM", name: "ui.output", value: output };
describe("OpenUI completion contract", () => {
  it("accepts validated output only after completion", async () => {
    const activity = vi.fn();
    expect(await readOutput(response([{ type: "CUSTOM", name: "ui.activity", value: { id: "run", label: "생성", status: "running" } }, result, { type: "RUN_FINISHED" }]), activity)).toEqual(output);
    expect(activity).toHaveBeenCalledOnce();
  });
  it("rejects interrupted streams and server errors", async () => {
    await expect(readOutput(response([result]), vi.fn())).rejects.toThrow("연결");
    await expect(readOutput(response([result, { type: "RUN_ERROR", message: "실패" }]), vi.fn())).rejects.toThrow("실패");
  });
  it("rejects invalid programs", async () => {
    await expect(readOutput(response([{ ...result, value: { ...output, program: 'root = MissingWidget()' } }, { type: "RUN_FINISHED" }]), vi.fn())).rejects.toThrow("검증");
  });
});
