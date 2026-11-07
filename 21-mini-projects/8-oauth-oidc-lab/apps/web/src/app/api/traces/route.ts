import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/server/session/request";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const { session } = sessionFromRequest(request);
  return NextResponse.json(
    { traces: session?.traces ?? [] },
    { headers: { "cache-control": "no-store" } },
  );
}
