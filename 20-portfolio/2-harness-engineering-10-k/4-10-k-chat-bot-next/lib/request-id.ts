export const REQUEST_ID_HEADER = "x-request-id";

function createFallbackRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? createFallbackRequestId();
}

export function getRequestIdFromHeaders(headers: Headers) {
  const incoming = headers.get(REQUEST_ID_HEADER)?.trim();
  return incoming || createRequestId();
}

export function withRequestIdHeader<T extends Response>(
  response: T,
  requestId: string
) {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
