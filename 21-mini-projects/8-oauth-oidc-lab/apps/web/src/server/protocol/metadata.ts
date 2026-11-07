import { internalizeEndpoint, type LabConfig } from "../config";
import type { LabSession } from "../session/types";
import { tracedFetch } from "./trace";

export interface OidcMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  code_challenge_methods_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`Discovery metadata is missing ${field}`);
  }
  return value;
}

export function parseMetadata(value: unknown, expectedIssuer: string): OidcMetadata {
  if (!value || typeof value !== "object") throw new Error("Discovery metadata must be an object");
  const data = value as Record<string, unknown>;
  const issuer = requiredString(data.issuer, "issuer");
  if (issuer !== expectedIssuer) {
    throw new Error(`Discovery issuer mismatch: expected ${expectedIssuer}, received ${issuer}`);
  }

  return {
    issuer,
    authorization_endpoint: requiredString(data.authorization_endpoint, "authorization_endpoint"),
    token_endpoint: requiredString(data.token_endpoint, "token_endpoint"),
    jwks_uri: requiredString(data.jwks_uri, "jwks_uri"),
    userinfo_endpoint: requiredString(data.userinfo_endpoint, "userinfo_endpoint"),
    end_session_endpoint: requiredString(data.end_session_endpoint, "end_session_endpoint"),
    code_challenge_methods_supported: Array.isArray(data.code_challenge_methods_supported)
      ? data.code_challenge_methods_supported.filter((item): item is string => typeof item === "string")
      : undefined,
    id_token_signing_alg_values_supported: Array.isArray(data.id_token_signing_alg_values_supported)
      ? data.id_token_signing_alg_values_supported.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

export async function fetchDiscoveryMetadata(config: LabConfig, session: LabSession): Promise<OidcMetadata> {
  const url = `${config.internalIssuer}/.well-known/openid-configuration`;
  const result = await tracedFetch({
    session,
    source: "Next.js BFF",
    destination: "Keycloak",
    url,
    explanation: "OIDC Discovery 문서에서 authorization, token, userinfo, JWKS, logout endpoint를 찾습니다.",
  });

  if (!result.ok) throw new Error(`OIDC Discovery failed with HTTP ${result.status}`);
  return parseMetadata(result.json, config.issuer);
}

export function internalEndpoint(endpoint: string, config: LabConfig): string {
  return internalizeEndpoint(endpoint, config);
}
