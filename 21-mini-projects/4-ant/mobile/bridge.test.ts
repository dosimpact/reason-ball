import { describe, expect, it } from "vitest";
import { parseMessage, eventScript } from "./bridge";
describe("native bridge boundary", () => {
  it("accepts only versioned known messages", () => {
    expect(parseMessage('{"v":1,"type":"READY"}')).toEqual({
      v: 1,
      type: "READY",
    });
    expect(parseMessage('{"v":2,"type":"READY"}')).toBeNull();
    expect(
      parseMessage('{"v":1,"type":"NAVIGATE","url":"https://example.com"}'),
    ).toBeNull();
    expect(parseMessage("not json")).toBeNull();
  });
  it("rejects injected or oversized request identifiers and invalid level values", () => {
    expect(
      parseMessage(
        JSON.stringify({
          v: 1,
          type: "REWARDED_HINT",
          requestId: "');alert(1)//",
        }),
      ),
    ).toBeNull();
    expect(
      parseMessage(
        JSON.stringify({
          v: 1,
          type: "REWARDED_HINT",
          requestId: "x".repeat(1024),
        }),
      ),
    ).toBeNull();
    expect(
      parseMessage('{"v":1,"type":"LEVEL_COMPLETE","level":1.5}'),
    ).toBeNull();
  });
  it("serializes a denied reward as data", () => {
    expect(
      eventScript({
        v: 1,
        type: "REWARDED_RESULT",
        requestId: "hint_1",
        earned: false,
      }),
    ).toContain('"earned":false');
  });
});
