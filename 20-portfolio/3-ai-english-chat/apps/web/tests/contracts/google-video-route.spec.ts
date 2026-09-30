import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, test } from "@playwright/test";
import * as zod from "zod";
import * as tokens from "../../src/shared/api/ai/google/video-token";
import * as media from "../../src/shared/api/ai/google/media";

const compiled = ts.transpileModule(readFileSync("src/app/api/ai/video/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class HttpError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
class ConfigError extends Error {}
function loadRoute(input: { owner?: string; trusted?: boolean; rateLimited?: boolean; failed?: boolean } = {}) {
  let starts = 0;
  let polls = 0;
  const exported: Record<string, unknown> = {};
  const errorResponse = (error: unknown) => Response.json({ code: error instanceof HttpError ? error.code : "PROVIDER_ERROR" }, { status: error instanceof HttpError ? error.status : 502 });
  new Function("require", "exports", compiled)((name: string) => {
    if (name === "zod") return zod;
    if (name === "@/shared/api/ai") return {
      AiHttpError: HttpError, AiConfigurationError: ConfigError,
      createRequestId: () => "test-request", enforceAiRateLimit: () => input.rateLimited ? new Response(null, { status: 429 }) : undefined,
      jsonSuccessResponse: (_id: string, body: unknown) => Response.json(body), safeAiErrorResponse: errorResponse,
      parseJsonBody: async (request: Request, schema: zod.ZodType) => {
        const parsed = schema.safeParse(await request.json());
        return parsed.success ? { ok: true, data: parsed.data } : { ok: false, response: new Response(null, { status: 400 }) };
      },
    };
    if (name === "@/shared/api/supabase/http") return {
      SupabaseHttpError: HttpError, safeSupabaseErrorResponse: errorResponse,
      assertTrustedMutationRequest: () => { if (input.trusted === false) throw new HttpError(403, "UNTRUSTED_ORIGIN", "Rejected"); },
      createRequestClient: async () => ({}), requireAuthenticatedUser: async () => { if (!input.owner) throw new HttpError(401, "AUTH_REQUIRED", "Login"); return { id: input.owner }; },
    };
    if (name === "@/shared/api/ai/google/video-token") return tokens;
    if (name === "@/shared/api/ai/google/media") return {
      ...media,
      startGoogleVideo: async () => { starts++; if (input.failed) throw new media.GoogleMediaError(503, true); return "operations/test-job"; },
      pollGoogleVideo: async () => { polls++; return { done: false }; },
    };
    throw new Error(`Unexpected import ${name}`);
  }, exported);
  return { POST: exported.POST as (request: Request) => Promise<Response>, GET: exported.GET as (request: Request) => Promise<Response>, calls: () => ({ starts, polls }) };
}
const saved = { key: process.env.GOOGLE_GENERATIVE_AI_API_KEY, mode: process.env.APP_RUNTIME_MODE, provider: process.env.AI_PROVIDER, model: process.env.AI_VIDEO_MODEL };
test.beforeEach(() => { process.env.GOOGLE_GENERATIVE_AI_API_KEY = "route-contract-key"; delete process.env.APP_RUNTIME_MODE; delete process.env.AI_PROVIDER; delete process.env.AI_VIDEO_MODEL; });
test.afterAll(() => { for (const [name, value] of Object.entries({ GOOGLE_GENERATIVE_AI_API_KEY: saved.key, APP_RUNTIME_MODE: saved.mode, AI_PROVIDER: saved.provider, AI_VIDEO_MODEL: saved.model })) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
function request(body: unknown = { prompt: "A friendly character waving hello" }) { return new Request("https://app.example/api/ai/video", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }); }

test("video POST denies unauthenticated, untrusted and rate-limited calls before paid generation", async () => {
  for (const [options, status] of [[{}, 401], [{ owner: "owner", trusted: false }, 403], [{ owner: "owner", rateLimited: true }, 429]] as const) {
    const route = loadRoute(options);
    expect((await route.POST(request())).status).toBe(status);
    expect(route.calls().starts).toBe(0);
  }
});
test("video accepts only prompt/aspect ratio and owner comes from the verified session", async () => {
  const route = loadRoute({ owner: "session-owner" });
  expect((await route.POST(request({ prompt: "A lovely waving character", ownerId: "attacker" }))).status).toBe(400);
  const response = await route.POST(request());
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(tokens.verifyVideoOperation(body.operationToken, "session-owner", Date.now(), "route-contract-key")).toBe("operations/test-job");
  expect(JSON.stringify(body)).not.toContain("route-contract-key");
});
test("video poll retry uses existing operation and never launches another billable job", async () => {
  const route = loadRoute({ owner: "owner" });
  const token = tokens.signVideoOperation({ operation: "operations/test-job", ownerId: "owner", expiresAt: Date.now() + 60000 }, "route-contract-key");
  const url = `https://app.example/api/ai/video?token=${encodeURIComponent(token)}`;
  expect((await route.GET(new Request(url))).status).toBe(200);
  expect((await route.GET(new Request(url))).status).toBe(200);
  expect(route.calls()).toEqual({ starts: 0, polls: 2 });
  const wrongOwner = loadRoute({ owner: "other" });
  expect((await wrongOwner.GET(new Request(url))).status).toBe(403);
  expect(wrongOwner.calls().polls).toBe(0);
});
test("provider start failure remains an error with no fabricated operation token", async () => {
  const route = loadRoute({ owner: "owner", failed: true });
  const response = await route.POST(request());
  expect(response.status).toBe(502);
  expect(await response.json()).not.toHaveProperty("operationToken");
});
