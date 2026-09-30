import { NextResponse } from "next/server";

import { safeNextPath } from "@/shared/api/supabase/auth";
import {
  createRequestClient,
  createRequestId,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
  throwAuthError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code || code.length > 4_096) {
      throw new SupabaseHttpError(
        400,
        "INVALID_AUTH_CALLBACK",
        "The authentication callback is invalid.",
      );
    }

    const client = await createRequestClient();
    const result = await client.auth.exchangeCodeForSession(code);
    if (result.error) throwAuthError(result.error, "auth.exchange_code");

    const destination = new URL(safeNextPath(url.searchParams.get("next")), url);
    destination.searchParams.set("auth", "confirmed");
    return NextResponse.redirect(destination, 303);
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
