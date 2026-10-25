import { ACTION_STEPS, createQueryManager } from "@openuidev/lang-core";
import { describe, expect, it, vi } from "vitest";
import { run } from "@/lib/functions/__tests__/run";
import builtins from "./builtins.json";
import { createBuiltinDemoTools } from "./builtin-tools";

const calculationNames = ["Count", "First", "Last", "Sum", "Avg", "Min", "Max", "Sort", "Filter", "Round", "Abs", "Floor", "Ceil", "Each"];

describe("built-in cases", () => {
  it("covers calculations, every exported action step, Action, Query and Mutation", () => {
    expect(builtins.map(story => story.name).sort()).toEqual([...calculationNames, ...Object.keys(ACTION_STEPS), "Action", "Query", "Mutation"].sort());
    expect(builtins.every(story => story.category === "builtins")).toBe(true);
  });
  for (const story of builtins.filter(story => calculationNames.includes(story.name))) {
    for (const example of story.examples.filter(example => example.code.includes("\nresult = "))) {
      it(`${story.name}: ${example.title} evaluates without errors`, () => {
        const result = run("result", example.code.split("\n").slice(1).join("\n"));
        expect(result.parseErrors).toEqual([]);
        expect(result.runtimeErrors).toEqual([]);
        expect(result.value).not.toBeUndefined();
      });
    }
  }
  it("defers Set and reads updated state between Action steps", () => {
    const result = run('0, Action([@Set($count, $count + 1), @Set($result, $count * 10)])', '$count = 0\n$result = 0');
    expect(result.parseErrors).toEqual([]);
    expect(result.action?.steps.map(step => step.type)).toEqual(["set", "set"]);
    expect(result.click()).toMatchObject({ $count: 1, $result: 10 });
  });
  it("keeps preview tools isolated and rejects invalid mutation input", async () => {
    const first = createBuiltinDemoTools();
    const second = createBuiltinDemoTools();
    await first.write_demo({ value: 42 });
    expect(await first.read_demo({ factor: 2 })).toMatchObject({ value: 42, calls: 1, rows: [{ name: "A", value: 20 }, { name: "B", value: 40 }] });
    expect(await second.read_demo({})).toMatchObject({ value: 0, calls: 1 });
    await expect(first.write_demo({ value: "42" })).rejects.toThrow("finite number");
  });
  it("queries automatically, runs mutations on demand, and refetches after invalidation", async () => {
    const tools = createBuiltinDemoTools();
    const provider = { callTool: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "read_demo") return tools.read_demo(args);
      if (name === "write_demo") return tools.write_demo(args);
      throw new Error(`Unknown demo tool: ${name}`);
    }) };
    const manager = createQueryManager(provider);
    const queries = [{ statementId: "data", toolName: "read_demo", args: {}, defaults: { value: 0, calls: 0, rows: [] }, deps: null, complete: true }];
    try {
      manager.evaluateQueries(queries);
      await vi.waitFor(() => expect(manager.getResult("data")).toMatchObject({ value: 0, calls: 1 }));
      manager.registerMutations([{ statementId: "saved", toolName: "write_demo" }]);
      expect(manager.getMutationResult("saved")?.status).toBe("idle");
      expect(provider.callTool).toHaveBeenCalledTimes(1);
      expect(await manager.fireMutation("saved", { value: 7 })).toBe(true);
      expect(manager.getMutationResult("saved")).toMatchObject({ status: "success", data: { value: 7 } });
      manager.invalidate(["data"]);
      manager.evaluateQueries(queries);
      await vi.waitFor(() => expect(manager.getResult("data")).toMatchObject({ value: 7, calls: 2 }));
    } finally {
      manager.dispose();
    }
  });
});
