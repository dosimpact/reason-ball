import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyIdToken } from "../src/server/protocol/verify";

const issuer = "http://localhost:8080/realms/oauth-lab";
const clientId = "oauth-lab-bff";
let privateKey: CryptoKey;
let keySet: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  const jwk = (await exportJWK(pair.publicKey)) as JWK;
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  keySet = createLocalJWKSet({ keys: [jwk] });
});

async function idToken(nonce: string) {
  return new SignJWT({ nonce, preferred_username: "learner" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(clientId)
    .setSubject("user-123")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("OIDC ID token verification", () => {
  it("accepts signature, issuer, audience, expiry, and nonce", async () => {
    const claims = await verifyIdToken(await idToken("expected-nonce"), "expected-nonce", keySet, {
      issuer,
      clientId,
    });
    expect(claims.sub).toBe("user-123");
  });

  it("rejects a nonce mismatch", async () => {
    await expect(
      verifyIdToken(await idToken("attacker-nonce"), "expected-nonce", keySet, { issuer, clientId }),
    ).rejects.toThrow("nonce mismatch");
  });
});
