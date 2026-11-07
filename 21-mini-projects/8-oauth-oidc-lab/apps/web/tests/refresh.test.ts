import { afterEach, describe, expect, it, vi } from "vitest";
import type { LabConfig } from "../src/server/config";
import type { OidcMetadata } from "../src/server/protocol/metadata";
import { refreshTokens } from "../src/server/protocol/tokens";
import type { LabSession, StoredTokenSet } from "../src/server/session/types";

const config: LabConfig = {
  appBaseUrl: "http://localhost:3000",
  publicKeycloakUrl: "http://localhost:8080",
  internalKeycloakUrl: "http://localhost:8080",
  realm: "oauth-lab",
  issuer: "http://localhost:8080/realms/oauth-lab",
  internalIssuer: "http://localhost:8080/realms/oauth-lab",
  clientId: "oauth-lab-bff",
  clientSecret: "client-secret",
  resourceAudience: "oauth-lab-resource",
  resourceServerUrl: "http://localhost:4000",
  redirectUri: "http://localhost:3000/api/auth/callback",
  sessionSecret: "test-session-secret-with-at-least-32-characters",
  secureCookie: false,
};

const metadata: OidcMetadata = {
  issuer: config.issuer,
  authorization_endpoint: `${config.issuer}/protocol/openid-connect/auth`,
  token_endpoint: `${config.issuer}/protocol/openid-connect/token`,
  jwks_uri: `${config.issuer}/protocol/openid-connect/certs`,
  userinfo_endpoint: `${config.issuer}/protocol/openid-connect/userinfo`,
  end_session_endpoint: `${config.issuer}/protocol/openid-connect/logout`,
};

const tokenSet: StoredTokenSet = {
  accessToken: "old-access-token",
  idToken: "old-id-token",
  refreshToken: "rejected-refresh-token",
  tokenType: "Bearer",
  scope: "openid resource.read",
  expiresAt: Date.now() - 1,
  accessClaims: {},
  idClaims: {},
};

const session: LabSession = {
  id: "session",
  createdAt: Date.now(),
  touchedAt: Date.now(),
  traces: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("refresh token failure", () => {
  it("returns the provider error without leaking the refresh token into trace", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "invalid_grant", error_description: "Token is not active" }),
      { status: 400, headers: { "content-type": "application/json" } },
    )));

    await expect(refreshTokens(tokenSet, metadata, config, session)).rejects.toThrow("HTTP 400");
    expect(JSON.stringify(session.traces)).not.toContain("rejected-refresh-token");
    expect(JSON.stringify(session.traces)).toContain("invalid_grant");
  });
});
