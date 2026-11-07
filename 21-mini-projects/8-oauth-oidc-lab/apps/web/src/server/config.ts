export interface LabConfig {
  appBaseUrl: string;
  publicKeycloakUrl: string;
  internalKeycloakUrl: string;
  realm: string;
  issuer: string;
  internalIssuer: string;
  clientId: string;
  clientSecret: string;
  resourceAudience: string;
  resourceServerUrl: string;
  redirectUri: string;
  sessionSecret: string;
  secureCookie: boolean;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function readLabConfig(env: NodeJS.ProcessEnv = process.env): LabConfig {
  const appBaseUrl = withoutTrailingSlash(env.APP_BASE_URL ?? "http://localhost:3000");
  const publicKeycloakUrl = withoutTrailingSlash(env.KEYCLOAK_PUBLIC_URL ?? "http://localhost:8180");
  const internalKeycloakUrl = withoutTrailingSlash(env.KEYCLOAK_INTERNAL_URL ?? publicKeycloakUrl);
  const realm = env.OIDC_REALM ?? "oauth-lab";
  const sessionSecret = env.SESSION_SECRET ?? "local-development-session-secret-32-chars";

  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }

  return {
    appBaseUrl,
    publicKeycloakUrl,
    internalKeycloakUrl,
    realm,
    issuer: `${publicKeycloakUrl}/realms/${realm}`,
    internalIssuer: `${internalKeycloakUrl}/realms/${realm}`,
    clientId: env.OIDC_CLIENT_ID ?? "oauth-lab-bff",
    clientSecret: env.OIDC_CLIENT_SECRET ?? "oauth-lab-secret-local-only",
    resourceAudience: env.OIDC_RESOURCE_AUDIENCE ?? "oauth-lab-resource",
    resourceServerUrl: withoutTrailingSlash(env.RESOURCE_SERVER_URL ?? "http://localhost:4000"),
    redirectUri: `${appBaseUrl}/api/auth/callback`,
    sessionSecret,
    secureCookie: env.COOKIE_SECURE === "true" || appBaseUrl.startsWith("https://"),
  };
}

export function internalizeEndpoint(endpoint: string, config: LabConfig): string {
  return endpoint.startsWith(config.publicKeycloakUrl)
    ? `${config.internalKeycloakUrl}${endpoint.slice(config.publicKeycloakUrl.length)}`
    : endpoint;
}
