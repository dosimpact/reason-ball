import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { readBearerToken, type AccessPrincipal, type VerifyAccessToken } from "./auth.js";

interface CreateAppOptions {
  verifyAccessToken: VerifyAccessToken;
  logger?: boolean;
}

interface AccessPolicy {
  scope?: string;
  role?: string;
}

function unauthorized(reply: FastifyReply, description: string) {
  return reply
    .header("WWW-Authenticate", `Bearer realm="oauth-lab", error="invalid_token"`)
    .code(401)
    .send({ error: "invalid_token", error_description: description });
}

function forbidden(reply: FastifyReply, description: string, scope?: string) {
  const challenge = scope
    ? `Bearer realm="oauth-lab", error="insufficient_scope", scope="${scope}"`
    : `Bearer realm="oauth-lab", error="insufficient_scope"`;

  return reply
    .header("WWW-Authenticate", challenge)
    .code(403)
    .send({ error: "insufficient_scope", error_description: description });
}

async function authorize(
  request: FastifyRequest,
  reply: FastifyReply,
  verifyAccessToken: VerifyAccessToken,
  policy: AccessPolicy,
): Promise<AccessPrincipal | undefined> {
  let principal: AccessPrincipal;

  try {
    const token = readBearerToken(request.headers.authorization);
    principal = await verifyAccessToken(token);
  } catch (error) {
    request.log.info({ error }, "access token rejected");
    unauthorized(reply, "A valid access token is required");
    return undefined;
  }

  if (policy.scope && !principal.scopes.includes(policy.scope)) {
    forbidden(reply, `The ${policy.scope} scope is required`, policy.scope);
    return undefined;
  }

  if (policy.role && !principal.roles.includes(policy.role)) {
    forbidden(reply, `The ${policy.role} role is required`);
    return undefined;
  }

  return principal;
}

export function createApp({ verifyAccessToken, logger = true }: CreateAppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.get("/health", () => ({ status: "ok", service: "oauth-lab-resource-server" }));

  app.get("/api/profile", async (request, reply) => {
    const principal = await authorize(request, reply, verifyAccessToken, { scope: "resource.read" });
    if (!principal) return;

    return {
      message: "Protected learner resource",
      subject: principal.subject,
      username: principal.username,
      scopes: principal.scopes,
      roles: principal.roles,
    };
  });

  app.get("/api/admin", async (request, reply) => {
    const principal = await authorize(request, reply, verifyAccessToken, {
      scope: "resource.read",
      role: "lab-admin",
    });
    if (!principal) return;

    return {
      message: "Protected administrator resource",
      subject: principal.subject,
      username: principal.username,
      scopes: principal.scopes,
      roles: principal.roles,
    };
  });

  return app;
}
