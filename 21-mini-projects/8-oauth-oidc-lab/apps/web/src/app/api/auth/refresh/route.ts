import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/server/http/origin";
import { fetchDiscoveryMetadata } from "@/server/protocol/metadata";
import { refreshTokens } from "@/server/protocol/tokens";
import { verifyTokenResponse } from "@/server/protocol/verify";
import { sessionFromRequest } from "@/server/session/request";
import { toSessionView } from "@/server/session/view";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { config, session } = sessionFromRequest(request);
  if (!isSameOrigin(request, config)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  if (!session?.tokens) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  try {
    const current = session.tokens;
    const metadata = await fetchDiscoveryMetadata(config, session);
    const raw = await refreshTokens(current, metadata, config, session);
    const refreshed = await verifyTokenResponse(raw, undefined, metadata, config, session);
    refreshed.refreshToken ??= current.refreshToken;
    session.tokens = refreshed;
    return NextResponse.json(toSessionView(session));
  } catch (error) {
    return NextResponse.json(
      { error: "refresh_failed", message: error instanceof Error ? error.message : "Refresh failed" },
      { status: 401 },
    );
  }
}
