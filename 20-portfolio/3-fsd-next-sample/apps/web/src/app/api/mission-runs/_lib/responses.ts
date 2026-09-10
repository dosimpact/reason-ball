export function isMockRuntime() {
  return process.env.APP_RUNTIME_MODE?.trim() === "mock";
}

export function routeError(
  status: number,
  code: string,
  message: string,
  requestId = crypto.randomUUID(),
) {
  return Response.json(
    { error: { code, message, retryable: false }, requestId },
    { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
  );
}

export function routeSuccess(payload: unknown, requestId = crypto.randomUUID()) {
  return Response.json(payload, {
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
  });
}
