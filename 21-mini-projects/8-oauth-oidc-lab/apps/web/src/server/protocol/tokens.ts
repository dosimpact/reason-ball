import type { LabConfig } from "../config";
import type { LabSession, PendingAuthorization, StoredTokenSet } from "../session/types";
import { randomUrlSafe } from "./crypto";
import { internalEndpoint, type OidcMetadata } from "./metadata";
import { tracedFetch } from "./trace";

interface RawTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

function parseTokenResponse(value: unknown): RawTokenResponse {
  if (!value || typeof value !== "object") throw new Error("Token response must be an object");
  const data = value as Record<string, unknown>;
  if (
    typeof data.access_token !== "string" ||
    typeof data.id_token !== "string" ||
    typeof data.token_type !== "string" ||
    typeof data.expires_in !== "number"
  ) {
    throw new Error("Token response is missing required fields");
  }

  return {
    access_token: data.access_token,
    id_token: data.id_token,
    refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    token_type: data.token_type,
    expires_in: data.expires_in,
    scope: typeof data.scope === "string" ? data.scope : undefined,
  };
}

function clientAuthorization(config: LabConfig): string {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
}

async function tokenRequest(
  form: URLSearchParams,
  metadata: OidcMetadata,
  config: LabConfig,
  session: LabSession,
  explanation: string,
): Promise<RawTokenResponse> {
  const url = internalEndpoint(metadata.token_endpoint, config);
  const result = await tracedFetch({
    session,
    source: "Next.js BFF",
    destination: "Keycloak",
    url,
    init: {
      method: "POST",
      headers: {
        authorization: clientAuthorization(config),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
    requestBody: Object.fromEntries(form.entries()),
    explanation,
  });

  if (!result.ok) {
    const error = new Error(`Token endpoint rejected the request with HTTP ${result.status}`);
    Object.assign(error, { status: result.status, body: result.json });
    throw error;
  }
  return parseTokenResponse(result.json);
}

export async function exchangeAuthorizationCode(
  code: string,
  pending: PendingAuthorization,
  metadata: OidcMetadata,
  config: LabConfig,
  session: LabSession,
): Promise<RawTokenResponse> {
  const verifier = pending.failureMode === "pkce" ? randomUrlSafe() : pending.codeVerifier;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: pending.redirectUri,
    code_verifier: verifier,
  });

  return tokenRequest(
    form,
    metadata,
    config,
    session,
    pending.failureMode === "pkce"
      ? "의도적으로 다른 code_verifier를 보내 Keycloak의 PKCE 검증 실패를 관찰합니다."
      : "Authorization Code와 원래 code_verifier를 Token Endpoint에서 교환합니다.",
  );
}

export async function refreshTokens(
  current: StoredTokenSet,
  metadata: OidcMetadata,
  config: LabConfig,
  session: LabSession,
): Promise<RawTokenResponse> {
  if (!current.refreshToken) throw new Error("No refresh token is available");
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refreshToken,
  });
  return tokenRequest(form, metadata, config, session, "서버에만 저장된 Refresh Token으로 새 token set을 요청합니다.");
}

export type { RawTokenResponse };
