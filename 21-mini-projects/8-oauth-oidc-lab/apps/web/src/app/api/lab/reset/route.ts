import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/server/http/origin";
import { expireSessionCookie } from "@/server/session/cookie";
import { sessionFromRequest } from "@/server/session/request";
import { deleteSession } from "@/server/session/store";

export async function POST(request: NextRequest) {
  const { config, session } = sessionFromRequest(request);
  if (!isSameOrigin(request, config)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  if (session) deleteSession(session.id);
  const response = NextResponse.json({ reset: true });
  expireSessionCookie(response, config);
  return response;
}
