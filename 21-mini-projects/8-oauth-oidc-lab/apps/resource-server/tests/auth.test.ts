import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createLocalJWKSet } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createAccessTokenVerifier } from "../src/auth.js";

const issuer = "http://issuer.test/realms/oauth-lab";
const audience = "oauth-lab-resource";
type GeneratedKeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let privateKey: GeneratedKeyPair["privateKey"];
let otherPrivateKey: GeneratedKeyPair["privateKey"];
let keyResolver: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const primary = await generateKeyPair("RS256", { extractable: true });
  const other = await generateKeyPair("RS256", { extractable: true });
  privateKey = primary.privateKey;
  otherPrivateKey = other.privateKey;
  const publicJwk = await exportJWK(primary.publicKey);
  publicJwk.kid = "lab-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  keyResolver = createLocalJWKSet({ keys: [publicJwk] });
});

async function token(overrides: Record<string, unknown> = {}, signingKey = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const { aud, exp, ...claims } = overrides;
  return new SignJWT({
    preferred_username: "learner",
    scope: "openid resource.read",
    realm_access: { roles: ["lab-user"] },
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "lab-key", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(typeof aud === "string" ? aud : audience)
    .setSubject("user-123")
    .setIssuedAt(now)
    .setExpirationTime(typeof exp === "number" ? exp : now + 300)
    .sign(signingKey);
}

function verifier() {
  return createAccessTokenVerifier(
    { issuer, audience, jwksUrl: "http://unused.test/jwks" },
    keyResolver,
  );
}

describe("access token verification", () => {
  it("accepts a correctly signed token and maps scopes and roles", async () => {
    const principal = await verifier()(await token());
    expect(principal.username).toBe("learner");
    expect(principal.scopes).toContain("resource.read");
    expect(principal.roles).toContain("lab-user");
  });

  it("rejects an expired access token", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(verifier()(await token({ exp: now - 1 }))).rejects.toMatchObject({
      code: "ERR_JWT_EXPIRED",
    });
  });

  it("rejects a token with the wrong audience", async () => {
    await expect(verifier()(await token({ aud: "other-resource" }))).rejects.toMatchObject({
      code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
    });
  });

  it("rejects a token with an invalid signature", async () => {
    await expect(verifier()(await token({}, otherPrivateKey))).rejects.toMatchObject({
      code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    });
  });
});
