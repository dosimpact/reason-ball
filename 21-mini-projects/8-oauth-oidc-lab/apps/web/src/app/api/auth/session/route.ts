import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/server/session/request";
import { toSessionView } from "@/server/session/view";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const { session } = sessionFromRequest(request);
  return NextResponse.json(toSessionView(session), {
    headers: { "cache-control": "no-store" },
  });
}
