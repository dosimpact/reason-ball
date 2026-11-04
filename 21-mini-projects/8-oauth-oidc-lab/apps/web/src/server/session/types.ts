import type { JWTPayload } from "jose";
import type { ProtocolTrace } from "../protocol/trace";

export type FailureMode = "none" | "pkce";

export interface PendingAuthorization {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  createdAt: number;
  failureMode: FailureMode;
}

export interface StoredTokenSet {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  tokenType: string;
  scope: string;
  expiresAt: number;
  accessClaims: JWTPayload;
  idClaims: JWTPayload;
}

export interface LabUser {
  subject: string;
  username: string;
  email?: string;
  name?: string;
}

export interface LabSession {
  id: string;
  createdAt: number;
  touchedAt: number;
  activeTraceId?: string;
  pending?: PendingAuthorization;
  tokens?: StoredTokenSet;
  user?: LabUser;
  traces: ProtocolTrace[];
}
