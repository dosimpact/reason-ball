export interface ResourceServerConfig {
  host: string;
  port: number;
  issuer: string;
  jwksUrl: string;
  audience: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ResourceServerConfig {
  const issuer = env.OIDC_ISSUER ?? "http://localhost:8180/realms/oauth-lab";

  return {
    host: env.HOST ?? "0.0.0.0",
    port: Number(env.PORT ?? 4000),
    issuer,
    jwksUrl: env.OIDC_JWKS_URL ?? `${issuer}/protocol/openid-connect/certs`,
    audience: env.OIDC_RESOURCE_AUDIENCE ?? "oauth-lab-resource",
  };
}
