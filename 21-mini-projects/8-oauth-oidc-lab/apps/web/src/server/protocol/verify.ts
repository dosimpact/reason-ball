import {
  createLocalJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from "jose";
import type { LabConfig } from "../config";
import type { LabSession, PendingAuthorization, StoredTokenSet } from "../session/types";
import { constantTimeEqual } from "./crypto";
import { internalEndpoint, type OidcMetadata } from "./metadata";
import { recordTrace, tracedFetch } from "./trace";
import type { RawTokenResponse } from "./tokens";

function isJsonWebKeySet(value: unknown): value is JSONWebKeySet {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { keys?: unknown }).keys),
  );
}

async function fetchKeySet(metadata: OidcMetadata, config: LabConfig, session: LabSession) {
  const result = await tracedFetch({
    session,
    source: "Next.js BFF",
    destination: "Keycloak",
    url: internalEndpoint(metadata.jwks_uri, config),
    explanation: "Keycloak의 JWKS에서 JWT 헤더의 kid와 일치하는 공개키를 조회합니다.",
  });
  if (!result.ok || !isJsonWebKeySet(result.json)) throw new Error("JWKS response is invalid");
  return createLocalJWKSet(result.json);
}

export async function verifyIdToken(
  idToken: string,
  expectedNonce: string | undefined,
  keySet: ReturnType<typeof createLocalJWKSet>,
  config: Pick<LabConfig, "issuer" | "clientId">,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(idToken, keySet, {
    issuer: config.issuer,
    audience: config.clientId,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "exp", "iat"],
  });

  if (expectedNonce !== undefined) {
    if (typeof payload.nonce !== "string" || !constantTimeEqual(payload.nonce, expectedNonce)) {
      throw new Error("ID token nonce mismatch");
    }
  }
  return payload;
}

async function verifyAccessToken(
  accessToken: string,
  keySet: ReturnType<typeof createLocalJWKSet>,
  config: Pick<LabConfig, "issuer" | "resourceAudience">,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(accessToken, keySet, {
    issuer: config.issuer,
    audience: config.resourceAudience,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "exp", "iat"],
  });
  return payload;
}

export async function verifyTokenResponse(
  raw: RawTokenResponse,
  pending: PendingAuthorization | undefined,
  metadata: OidcMetadata,
  config: LabConfig,
  session: LabSession,
): Promise<StoredTokenSet> {
  const startedAt = performance.now();
  const keySet = await fetchKeySet(metadata, config, session);
  const [idClaims, accessClaims] = await Promise.all([
    verifyIdToken(raw.id_token, pending?.nonce, keySet, config),
    verifyAccessToken(raw.access_token, keySet, config),
  ]);

  recordTrace(session, {
    source: "Next.js BFF",
    destination: "Next.js BFF",
    method: "VERIFY",
    url: "local://jose/jwt-verify",
    request: {
      body: {
        checks: ["RS256 signature", "issuer", "audience", "expiration", ...(pending ? ["nonce"] : [])],
      },
    },
    response: { status: 200, statusText: "VERIFIED", body: { idClaims, accessClaims } },
    duration: Math.round(performance.now() - startedAt),
    explanation: "jose로 ID Token과 Access Token의 서명 및 필수 claim을 검증했습니다.",
    observation: "local-validation",
  });

  return {
    accessToken: raw.access_token,
    idToken: raw.id_token,
    refreshToken: raw.refresh_token,
    tokenType: raw.token_type,
    scope: raw.scope ?? (typeof accessClaims.scope === "string" ? accessClaims.scope : ""),
    expiresAt: Date.now() + raw.expires_in * 1000,
    accessClaims,
    idClaims,
  };
}

export async function fetchUserInfo(
  tokens: StoredTokenSet,
  metadata: OidcMetadata,
  config: LabConfig,
  session: LabSession,
): Promise<Record<string, unknown>> {
  const result = await tracedFetch({
    session,
    source: "Next.js BFF",
    destination: "Keycloak",
    url: internalEndpoint(metadata.userinfo_endpoint, config),
    init: { headers: { authorization: `Bearer ${tokens.accessToken}` } },
    explanation: "Access Token으로 OIDC UserInfo Endpoint를 호출하고 subject를 ID Token과 대조합니다.",
  });
  if (!result.ok || !result.json || typeof result.json !== "object") {
    throw new Error(`UserInfo request failed with HTTP ${result.status}`);
  }
  const userInfo = result.json as Record<string, unknown>;
  if (userInfo.sub !== tokens.idClaims.sub) throw new Error("UserInfo subject does not match ID token subject");
  return userInfo;
}
