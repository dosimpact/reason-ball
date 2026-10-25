import { afterEach, expect, it, vi } from "vitest";
import { EMPTY } from "@/entities/dashboard";
import { command, useDashboard } from "./store";

afterEach(() => vi.unstubAllGlobals());
it("serializes rapid local changes using each accepted server revision", async () => {
  useDashboard.setState({ documents: { rapid: { ...EMPTY, revision: 0 } }, errors: {} });
  const revisions: number[] = [];
  let running = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    expect(running++).toBe(0);
    const body = JSON.parse(options.body);
    revisions.push(body.base_revision);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
    return new Response(JSON.stringify({ ...EMPTY, revision: body.base_revision + 1 }));
  }));
  await Promise.all([
    command("rapid", "ui_state", "memo", { $memo: "question" }),
    command("rapid", "ui_state", "check", { $source: true }),
    command("rapid", "ui_state", "check", { $source: true, $citation: true }),
  ]);
  expect(revisions).toEqual([0, 1, 2]);
  expect(useDashboard.getState().documents.rapid.revision).toBe(3);
});
