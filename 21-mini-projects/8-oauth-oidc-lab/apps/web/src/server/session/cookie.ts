import type { NextResponse } from "next/server";
import type { LabConfig } from "../config";
import { encodeSessionCookie, sessionCookie } from "./store";
import type { LabSession } from "./types";

export function attachSessionCookie(response: NextResponse, session: LabSession, config: LabConfig): void {
  response.cookies.set(sessionCookie.name, encodeSessionCookie(session.id, config.sessionSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    path: "/api",
    maxAge: sessionCookie.maxAge,
    priority: "high",
  });
}

export function expireSessionCookie(response: NextResponse, config: LabConfig): void {
  response.cookies.set(sessionCookie.name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    path: "/api",
    maxAge: 0,
  });
}
