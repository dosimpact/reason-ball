import { describe, expect, it } from "vitest";
import { decodeSessionCookie, encodeSessionCookie } from "../src/server/session/store";

const secret = "test-session-secret-with-at-least-32-characters";

describe("session cookie", () => {
  it("round-trips a signed opaque session id", () => {
    const cookie = encodeSessionCookie("opaque-session-id", secret);
    expect(decodeSessionCookie(cookie, secret)).toBe("opaque-session-id");
  });

  it("rejects a tampered session id or signature", () => {
    const cookie = encodeSessionCookie("opaque-session-id", secret);
    expect(decodeSessionCookie(cookie.replace("opaque", "changed"), secret)).toBeUndefined();
    expect(decodeSessionCookie(`${cookie}x`, secret)).toBeUndefined();
  });
});
