import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { LabConfig } from "../config";
import type { LabSession } from "./types";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

declare global {
  var __oauthLabSessions: Map<string, LabSession> | undefined;
}

const sessions = globalThis.__oauthLabSessions ?? new Map<string, LabSession>();
globalThis.__oauthLabSessions = sessions;

function signature(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId).digest("base64url");
}

export function encodeSessionCookie(sessionId: string, secret: string): string {
  return `${sessionId}.${signature(sessionId, secret)}`;
}

export function decodeSessionCookie(cookieValue: string | undefined, secret: string): string | undefined {
  if (!cookieValue) return undefined;
  const [sessionId, actualSignature, ...rest] = cookieValue.split(".");
  if (!sessionId || !actualSignature || rest.length > 0) return undefined;
  const expectedSignature = signature(sessionId, secret);
  const actual = Buffer.from(actualSignature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
  return sessionId;
}

function purgeExpired(now = Date.now()): void {
  for (const [sessionId, session] of sessions) {
    if (now - session.touchedAt > SESSION_TTL_MS) sessions.delete(sessionId);
  }
}

export function createSession(): LabSession {
  purgeExpired();
  const now = Date.now();
  const session: LabSession = {
    id: randomBytes(32).toString("base64url"),
    createdAt: now,
    touchedAt: now,
    traces: [],
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(cookieValue: string | undefined, config: LabConfig): LabSession | undefined {
  purgeExpired();
  const sessionId = decodeSessionCookie(cookieValue, config.sessionSecret);
  if (!sessionId) return undefined;
  const session = sessions.get(sessionId);
  if (session) session.touchedAt = Date.now();
  return session;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function clearSessionAuthentication(session: LabSession): void {
  delete session.pending;
  delete session.tokens;
  delete session.user;
}

export const sessionCookie = {
  name: "oauth_lab_sid",
  maxAge: SESSION_TTL_MS / 1000,
};
