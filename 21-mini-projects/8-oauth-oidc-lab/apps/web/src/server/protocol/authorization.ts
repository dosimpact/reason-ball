import type { LabConfig } from "../config";
import { createPkcePair, randomUrlSafe } from "./crypto";
import type { OidcMetadata } from "./metadata";
import type { FailureMode, PendingAuthorization } from "../session/types";

export interface AuthorizationStart {
  url: string;
  pending: PendingAuthorization;
}

export function createAuthorizationRequest(
  metadata: OidcMetadata,
  config: LabConfig,
  failureMode: FailureMode = "none",
): AuthorizationStart {
  if (!metadata.code_challenge_methods_supported?.includes("S256")) {
    throw new Error("Authorization Server does not advertise PKCE S256 support");
  }

  const state = randomUrlSafe();
  const nonce = randomUrlSafe();
  const pkce = createPkcePair();
  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "openid resource.read");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", pkce.method);

  return {
    url: url.toString(),
    pending: {
      state,
      nonce,
      codeVerifier: pkce.verifier,
      codeChallenge: pkce.challenge,
      redirectUri: config.redirectUri,
      createdAt: Date.now(),
      failureMode,
    },
  };
}

export function validateAuthorizationState(
  receivedState: string | null,
  pending: PendingAuthorization | undefined,
  now = Date.now(),
): void {
  if (!pending) throw new Error("No pending authorization transaction exists");
  if (now - pending.createdAt > 10 * 60 * 1000) throw new Error("Authorization transaction expired");
  if (!receivedState || receivedState !== pending.state) throw new Error("Authorization state mismatch");
}
