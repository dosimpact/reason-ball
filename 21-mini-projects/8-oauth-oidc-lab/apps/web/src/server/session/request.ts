import type { NextRequest } from "next/server";
import { readLabConfig } from "../config";
import { createSession, getSession, sessionCookie } from "./store";

export function sessionFromRequest(request: NextRequest) {
  const config = readLabConfig();
  const value = request.cookies.get(sessionCookie.name)?.value;
  return { config, session: getSession(value, config) };
}

export function sessionOrCreate(request: NextRequest) {
  const resolved = sessionFromRequest(request);
  return { ...resolved, session: resolved.session ?? createSession() };
}
