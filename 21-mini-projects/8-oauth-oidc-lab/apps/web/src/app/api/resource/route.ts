import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/server/http/origin";
import { tracedFetch } from "@/server/protocol/trace";
import { sessionFromRequest } from "@/server/session/request";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { config, session } = sessionFromRequest(request);
  if (!isSameOrigin(request, config)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  if (!session?.tokens) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const target =
    payload && typeof payload === "object" && (payload as { target?: unknown }).target === "admin"
      ? "admin"
      : "profile";
  const url = `${config.resourceServerUrl}/api/${target}`;

  try {
    const result = await tracedFetch({
      session,
      source: "Next.js BFF",
      destination: "Resource Server",
      url,
      init: {
        headers: {
          authorization: `Bearer ${session.tokens.accessToken}`,
          "x-trace-id": session.activeTraceId ?? "",
        },
      },
      explanation:
        target === "admin"
          ? "Access Token은 유효하지만 lab-admin 역할이 없는 사용자는 403을 받습니다."
          : "Resource Server가 Access Token의 signature, issuer, audience, expiry, scope를 독립 검증합니다.",
    });

    return NextResponse.json(
      { status: result.status, statusText: result.statusText, body: result.json },
      { status: result.status },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "resource_server_unavailable", message: error instanceof Error ? error.message : "Request failed" },
      { status: 502 },
    );
  }
}
