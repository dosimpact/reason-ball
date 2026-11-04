import { describe, expect, it } from "vitest";
import { validateAuthorizationState } from "../src/server/protocol/authorization";
import type { PendingAuthorization } from "../src/server/session/types";

function pending(overrides: Partial<PendingAuthorization> = {}): PendingAuthorization {
  return {
    state: "expected-state",
    nonce: "nonce",
    codeVerifier: "verifier",
    codeChallenge: "challenge",
    redirectUri: "http://localhost:3000/api/auth/callback",
    createdAt: 1_000_000,
    failureMode: "none",
    ...overrides,
  };
}

describe("authorization callback state", () => {
  it("accepts the exact pending state", () => {
    expect(() => validateAuthorizationState("expected-state", pending(), 1_100_000)).not.toThrow();
  });

  it("rejects a missing or modified state before token exchange", () => {
    expect(() => validateAuthorizationState("attacker-state", pending(), 1_100_000)).toThrow("state mismatch");
    expect(() => validateAuthorizationState(null, pending(), 1_100_000)).toThrow("state mismatch");
  });

  it("rejects an expired authorization transaction", () => {
    expect(() => validateAuthorizationState("expected-state", pending(), 1_700_001)).toThrow("expired");
  });
});
