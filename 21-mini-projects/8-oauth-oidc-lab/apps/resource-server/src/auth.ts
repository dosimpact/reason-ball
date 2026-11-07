import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
} from "jose";

export interface AccessPrincipal {
  subject: string;
  username: string;
  scopes: string[];
  roles: string[];
  claims: JWTPayload;
}

export interface TokenVerifierConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
}

export type VerifyAccessToken = (token: string) => Promise<AccessPrincipal>;

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readRealmRoles(payload: JWTPayload): string[] {
  const realmAccess = payload.realm_access;
  if (!realmAccess || typeof realmAccess !== "object") {
    return [];
  }

  return stringArray((realmAccess as { roles?: unknown }).roles);
}

export function principalFromClaims(payload: JWTPayload): AccessPrincipal {
  if (!payload.sub) {
    throw new Error("The access token is missing the required sub claim");
  }

  return {
    subject: payload.sub,
    username: typeof payload.preferred_username === "string" ? payload.preferred_username : payload.sub,
    scopes: typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [],
    roles: readRealmRoles(payload),
    claims: payload,
  };
}

export function createAccessTokenVerifier(
  config: TokenVerifierConfig,
  keyResolver: JWTVerifyGetKey = createRemoteJWKSet(new URL(config.jwksUrl)),
): VerifyAccessToken {
  const verification: JWTVerifyOptions = {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "exp", "iat"],
  };

  return async (token: string) => {
    const { payload } = await jwtVerify(token, keyResolver, verification);
    return principalFromClaims(payload);
  };
}

export function readBearerToken(header: string | undefined): string {
  if (!header) {
    throw new Error("Missing Authorization header");
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match?.[1]) {
    throw new Error("Authorization header must use the Bearer scheme");
  }

  return match[1];
}
