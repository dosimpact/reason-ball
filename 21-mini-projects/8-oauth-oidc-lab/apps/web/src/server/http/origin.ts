import type { NextRequest } from "next/server";
import type { LabConfig } from "../config";

export function isSameOrigin(request: NextRequest, config: LabConfig): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(config.appBaseUrl).origin;
  } catch {
    return false;
  }
}
