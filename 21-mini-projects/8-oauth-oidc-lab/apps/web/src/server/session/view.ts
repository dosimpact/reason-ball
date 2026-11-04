import type { LabSession } from "./types";

export interface SessionView {
  authenticated: boolean;
  user: LabSession["user"] | null;
  token: {
    expiresAt: number;
    expiresInSeconds: number;
    scope: string;
    accessClaims: Record<string, unknown>;
    idClaims: Record<string, unknown>;
  } | null;
  traceCount: number;
}

export function toSessionView(session: LabSession | undefined): SessionView {
  const tokens = session?.tokens;

  return {
    authenticated: Boolean(tokens && session?.user),
    user: session?.user ?? null,
    token: tokens
      ? {
          expiresAt: tokens.expiresAt,
          expiresInSeconds: Math.max(0, Math.floor((tokens.expiresAt - Date.now()) / 1000)),
          scope: tokens.scope,
          accessClaims: { ...tokens.accessClaims },
          idClaims: { ...tokens.idClaims },
        }
      : null,
    traceCount: session?.traces.length ?? 0,
  };
}
