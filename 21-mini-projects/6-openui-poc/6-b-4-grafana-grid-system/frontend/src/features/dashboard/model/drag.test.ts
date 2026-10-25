import { expect, it } from "vitest";
import { parseCanvasDrag } from "./drag";
it("carries artifact inputs without allowing a cross-thread payload", () => {
  const payload = {
    version: 1,
    threadId: "current",
    type: "artifact",
    artifactId: "a",
    uiState: { $amount: 150 },
  };
  expect(parseCanvasDrag(JSON.stringify(payload), "current")).toEqual(payload);
  expect(() => parseCanvasDrag(JSON.stringify(payload), "other")).toThrow(
    "Cross-thread",
  );
});
it("accepts panel references but rejects malformed, oversized or unknown payloads", () => {
  expect(
    parseCanvasDrag(
      JSON.stringify({
        version: 1,
        threadId: "t",
        type: "panel",
        panelId: "p",
      }),
      "t",
    ).type,
  ).toBe("panel");
  for (const raw of [
    "{",
    "a".repeat(65537),
    JSON.stringify({ version: 2, threadId: "t", type: "panel", panelId: "p" }),
    JSON.stringify({
      version: 1,
      threadId: "t",
      type: "script",
      code: "invalid",
    }),
  ])
    expect(() => parseCanvasDrag(raw, "t")).toThrow();
});
