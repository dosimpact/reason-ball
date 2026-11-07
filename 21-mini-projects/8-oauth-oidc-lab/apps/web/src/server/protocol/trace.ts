import { randomUUID } from "node:crypto";
import type { LabSession } from "../session/types";

export type TraceActor = "Browser" | "Next.js BFF" | "Keycloak" | "Resource Server";
export type TraceObservation = "observed" | "reconstructed" | "local-validation";

export interface TraceMessage {
  headers?: Record<string, string>;
  body?: unknown;
}

export interface TraceResponse extends TraceMessage {
  status: number;
  statusText?: string;
}

export interface ProtocolTrace {
  traceId: string;
  stepId: string;
  timestamp: string;
  source: TraceActor;
  destination: TraceActor;
  method: string;
  url: string;
  request: TraceMessage;
  response: TraceResponse;
  duration: number;
  explanation: string;
  observation: TraceObservation;
}

export interface TraceInput extends Omit<ProtocolTrace, "traceId" | "stepId" | "timestamp"> {
  traceId?: string;
  stepId?: string;
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "code",
  "state",
  "nonce",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "id_token_hint",
  "client_secret",
  "code_verifier",
  "session_state",
]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

function masked(): string {
  return "[MASKED]";
}

export function sanitizeValue(value: unknown, key = ""): unknown {
  if (isSensitiveKey(key)) {
    return masked();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value === "string" && /(^location$|url$|uri$)/i.test(key)) {
    return sanitizeUrl(value);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey)]),
    );
  }

  return value;
}

export function sanitizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const [key] of url.searchParams) {
      if (isSensitiveKey(key)) {
        url.searchParams.set(key, masked());
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function recordTrace(session: LabSession, input: TraceInput): ProtocolTrace {
  const trace: ProtocolTrace = {
    ...input,
    traceId: input.traceId ?? session.activeTraceId ?? randomUUID(),
    stepId: input.stepId ?? randomUUID(),
    timestamp: new Date().toISOString(),
    url: sanitizeUrl(input.url),
    request: sanitizeValue(input.request) as TraceMessage,
    response: sanitizeValue(input.response) as TraceResponse,
  };

  session.activeTraceId = trace.traceId;
  session.traces.push(trace);
  if (session.traces.length > 200) session.traces.splice(0, session.traces.length - 200);
  return trace;
}

interface TracedFetchInput {
  session: LabSession;
  source: TraceActor;
  destination: TraceActor;
  url: string;
  init?: RequestInit;
  requestBody?: unknown;
  explanation: string;
}

export interface TracedFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  json: unknown;
}

function parseBody(bodyText: string): unknown {
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return bodyText;
  }
}

export async function tracedFetch(input: TracedFetchInput): Promise<TracedFetchResult> {
  const startedAt = performance.now();
  const method = input.init?.method ?? "GET";
  const requestHeaders = new Headers(input.init?.headers);

  try {
    const response = await fetch(input.url, { ...input.init, cache: "no-store" });
    const bodyText = await response.text();
    const json = parseBody(bodyText);
    const responseHeaders = Object.fromEntries(response.headers.entries());

    recordTrace(input.session, {
      source: input.source,
      destination: input.destination,
      method,
      url: input.url,
      request: {
        headers: Object.fromEntries(requestHeaders.entries()),
        body: input.requestBody ?? null,
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: json,
      },
      duration: Math.round(performance.now() - startedAt),
      explanation: input.explanation,
      observation: "observed",
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      bodyText,
      json,
    };
  } catch (error) {
    recordTrace(input.session, {
      source: input.source,
      destination: input.destination,
      method,
      url: input.url,
      request: {
        headers: Object.fromEntries(requestHeaders.entries()),
        body: input.requestBody ?? null,
      },
      response: {
        status: 0,
        statusText: "NETWORK_ERROR",
        body: { error: error instanceof Error ? error.message : "Unknown network error" },
      },
      duration: Math.round(performance.now() - startedAt),
      explanation: input.explanation,
      observation: "observed",
    });
    throw error;
  }
}
