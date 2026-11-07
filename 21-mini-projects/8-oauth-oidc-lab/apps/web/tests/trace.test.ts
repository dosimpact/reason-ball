import { describe, expect, it } from "vitest";
import { sanitizeUrl, sanitizeValue } from "../src/server/protocol/trace";

describe("protocol trace sanitization", () => {
  it("masks OAuth secrets recursively while retaining the PKCE challenge", () => {
    const result = sanitizeValue({
      access_token: "access-secret-value",
      refresh_token: "refresh-secret-value",
      code: "authorization-code",
      code_verifier: "pkce-verifier",
      code_challenge: "public-challenge",
      headers: { authorization: "Bearer secret", cookie: "sid=secret" },
    }) as Record<string, unknown>;

    expect(JSON.stringify(result)).not.toContain("access-secret-value");
    expect(JSON.stringify(result)).not.toContain("authorization-code");
    expect(JSON.stringify(result)).not.toContain("pkce-verifier");
    expect(JSON.stringify(result)).toContain("public-challenge");
  });

  it("masks sensitive query parameters in redirect URLs", () => {
    const sanitized = sanitizeUrl("http://localhost/callback?code=secret&state=state-secret&safe=value");
    expect(sanitized).not.toContain("code=secret");
    expect(sanitized).not.toContain("state-secret");
    expect(sanitized).toContain("safe=value");
  });
});
