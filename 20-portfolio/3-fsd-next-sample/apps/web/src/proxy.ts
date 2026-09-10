import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/shared/api/supabase/middleware";

// Next.js discovers Proxy beside src/app, not at the workspace app root.
export function proxy(request: NextRequest) {
  if (process.env.APP_RUNTIME_MODE?.trim() === "mock") {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
