import { NextRequest, NextResponse } from "next/server";
import { validateAuthorizationState } from "@/server/protocol/authorization";
import { fetchDiscoveryMetadata } from "@/server/protocol/metadata";
import { exchangeAuthorizationCode } from "@/server/protocol/tokens";
import { recordTrace } from "@/server/protocol/trace";
import { fetchUserInfo, verifyTokenResponse } from "@/server/protocol/verify";
import { attachSessionCookie } from "@/server/session/cookie";
import { sessionOrCreate } from "@/server/session/request";

export const dynamic = "force-dynamic";

function redirectResult(appBaseUrl: string, key: string, value: string) {
  const url = new URL("/", appBaseUrl);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { config, session } = sessionOrCreate(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");
  const pending = session.pending;

  recordTrace(session, {
    source: "Browser",
    destination: "Next.js BFF",
    method: "GET",
    url: request.url,
    request: {},
    response: { status: 0, statusText: "PROCESSING", body: null },
    duration: 0,
    explanation: "브라우저가 Keycloak의 redirect를 따라 Authorization Code와 state를 BFF callback으로 전달했습니다.",
    observation: "observed",
  });

  try {
    if (providerError) throw new Error(`Authorization Server returned ${providerError}`);
    validateAuthorizationState(state, pending);
    if (!code) throw new Error("Authorization callback is missing code");
    if (!pending) throw new Error("No pending authorization transaction exists");

    const metadata = await fetchDiscoveryMetadata(config, session);
    const rawTokens = await exchangeAuthorizationCode(code, pending, metadata, config, session);
    const tokens = await verifyTokenResponse(rawTokens, pending, metadata, config, session);
    const userInfo = await fetchUserInfo(tokens, metadata, config, session);

    session.tokens = tokens;
    session.user = {
      subject: String(userInfo.sub),
      username: typeof userInfo.preferred_username === "string" ? userInfo.preferred_username : String(userInfo.sub),
      email: typeof userInfo.email === "string" ? userInfo.email : undefined,
      name: typeof userInfo.name === "string" ? userInfo.name : undefined,
    };
    delete session.pending;

    recordTrace(session, {
      source: "Next.js BFF",
      destination: "Browser",
      method: "SET-COOKIE",
      url: config.appBaseUrl,
      request: {},
      response: {
        status: 302,
        statusText: "LOGIN_COMPLETE",
        headers: { "set-cookie": "oauth_lab_sid=<signed opaque id>; Path=/api; HttpOnly; SameSite=Lax" },
        body: { authenticated: true, username: session.user.username },
      },
      duration: 0,
      explanation: "Token은 서버 세션에만 저장하고 브라우저에는 불투명한 HttpOnly 세션 쿠키만 유지합니다.",
      observation: "observed",
    });

    const response = redirectResult(config.appBaseUrl, "login", "success");
    attachSessionCookie(response, session, config);
    return response;
  } catch (error) {
    delete session.pending;
    const message = error instanceof Error ? error.message : "Unknown callback failure";
    recordTrace(session, {
      source: "Next.js BFF",
      destination: "Browser",
      method: "REDIRECT",
      url: config.appBaseUrl,
      request: {},
      response: { status: 302, statusText: "LOGIN_FAILED", body: { error: message } },
      duration: 0,
      explanation: message.toLowerCase().includes("state")
        ? "state 검증 실패로 code를 Token Endpoint에 보내지 않고 흐름을 중단했습니다."
        : "OIDC callback 검증 또는 token 교환이 실패하여 인증 세션을 만들지 않았습니다.",
      observation: "observed",
    });
    const reason = message.includes("Token endpoint") ? "pkce_or_token_exchange_failed" : "callback_validation_failed";
    const response = redirectResult(config.appBaseUrl, "labError", reason);
    attachSessionCookie(response, session, config);
    return response;
  }
}
