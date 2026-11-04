import { describe, expect, it } from "vitest";
import { constantTimeEqual, createPkcePair } from "../src/server/protocol/crypto";

describe("PKCE", () => {
  it("matches the RFC 7636 S256 example", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(createPkcePair(verifier)).toEqual({
      verifier,
      challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      method: "S256",
    });
  });

  it("compares security parameters without early character exits", () => {
    expect(constantTimeEqual("same-state", "same-state")).toBe(true);
    expect(constantTimeEqual("wrong-state", "right-state")).toBe(false);
    expect(constantTimeEqual("short", "longer-value")).toBe(false);
  });
});
