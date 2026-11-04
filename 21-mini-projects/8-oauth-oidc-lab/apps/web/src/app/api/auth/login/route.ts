import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAuthorizationRequest } from "@/server/protocol/authorization";
import { fetchDiscoveryMetadata } from "@/server/protocol/metadata";
import { recordTrace } from "@/server/protocol/trace";
import { attachSessionCookie } from "@/server/session/cookie";
import { sessionOrCreate } from "@/server/session/request";
import type { FailureMode } from "@/server/session/types";

export const dynamic = "force-dynamic";

function failureMode(request: NextRequest): FailureMode {
  return request.nextUrl.searchParams.get("scenario") === "pkce-failure" ? "pkce" : "none";
}

export async function GET(request: NextRequest) {
  const { config, session } = sessionOrCreate(request);
  session.activeTraceId = randomUUID();

  try {
    const metadata = await fetchDiscoveryMetadata(config, session);
    const authorization = createAuthorizationRequest(metadata, config, failureMode(request));
    session.pending = authorization.pending;

    recordTrace(session, {
      source: "Browser",
      destination: "Next.js BFF",
      method: "GET",
      url: request.url,
      request: { headers: { accept: request.headers.get("accept") ?? "" } },
      response: { status: 302, statusText: "Found", headers: { location: authorization.url } },
      duration: 0,
      explanation: "BFF가 state, nonce, PKCE verifier/challenge를 만들고 Authorization URL을 반환합니다.",
      observation: "observed",
    });
    recordTrace(session, {
      source: "Browser",
      destination: "Keycloak",
      method: "GET",
      url: authorization.url,
      request: {},
      response: { status: 0, statusText: "AWAITING_BROWSER", body: null },
      duration: 0,
      explanation: "Location 헤더로 지시한 브라우저 Authorization Request입니다. BFF가 응답을 직접 볼 수 없어 재구성한 단계입니다.",
      observation: "reconstructed",
    });

    const response = NextResponse.redirect(authorization.url);
    response.headers.set("cache-control", "no-store");
    attachSessionCookie(response, session, config);
    return response;
  } catch (error) {
    recordTrace(session, {
      source: "Browser",
      destination: "Next.js BFF",
      method: "GET",
      url: request.url,
      request: {},
      response: {
        status: 503,
        statusText: "AUTHORIZATION_SERVER_UNAVAILABLE",
        body: { error: error instanceof Error ? error.message : "Unable to start login" },
      },
      duration: 0,
      explanation: "Authorization Server 연결 또는 Discovery 검증에 실패했습니다.",
      observation: "observed",
    });
    const response = NextResponse.redirect(new URL("/?labError=authorization_server_unavailable", config.appBaseUrl));
    attachSessionCookie(response, session, config);
    return response;
  }
}
