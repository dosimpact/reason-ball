import { NextRequest, NextResponse } from "next/server";
import { fetchDiscoveryMetadata } from "@/server/protocol/metadata";
import { recordTrace } from "@/server/protocol/trace";
import { sessionFromRequest } from "@/server/session/request";
import { clearSessionAuthentication } from "@/server/session/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { config, session } = sessionFromRequest(request);
  if (!session) return NextResponse.redirect(config.appBaseUrl);

  try {
    const metadata = await fetchDiscoveryMetadata(config, session);
    const logout = new URL(metadata.end_session_endpoint);
    logout.searchParams.set("client_id", config.clientId);
    logout.searchParams.set("post_logout_redirect_uri", config.appBaseUrl);
    clearSessionAuthentication(session);
    recordTrace(session, {
      source: "Browser",
      destination: "Keycloak",
      method: "GET",
      url: logout.toString(),
      request: {},
      response: { status: 0, statusText: "AWAITING_BROWSER", body: null },
      duration: 0,
      explanation: "브라우저를 OIDC end_session_endpoint로 보내 Keycloak SSO 세션도 종료합니다. ID Token은 URL에 노출하지 않습니다.",
      observation: "reconstructed",
    });
    return NextResponse.redirect(logout);
  } catch {
    clearSessionAuthentication(session);
    return NextResponse.redirect(new URL("/?labError=logout_provider_unavailable", config.appBaseUrl));
  }
}
