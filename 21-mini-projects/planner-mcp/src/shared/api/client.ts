export class PlannerResponseError extends Error {
  constructor(
    public code: string,
    message: string,
    public uncertain: boolean,
  ) {
    super(`${code}: ${message}`);
    this.name = "PlannerResponseError";
  }
}

export async function plannerRequest<T>(
  input: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("/api/planner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: [
      "projects",
      "project",
      "index",
      "document",
      "relations",
      "compare",
      "collaboration",
      "catalog",
      "handoff",
    ].includes(String(input.action))
      ? AbortSignal.timeout(15_000)
      : AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  if (!response.ok) {
    const code = body.error?.code;
    throw new PlannerResponseError(
      code ?? "INVALID_RESPONSE",
      body.error?.message ?? "서버 응답을 확인하지 못했습니다.",
      response.status >= 500 ||
        !code ||
        code === "STORAGE_WRITE_FAILED" ||
        code === "INTERNAL_ERROR",
    );
  }
  if (!Object.hasOwn(body, "result"))
    throw new PlannerResponseError(
      "INVALID_RESPONSE",
      "결과가 없는 응답입니다.",
      true,
    );
  return body.result as T;
}

/** Keep the exact operation alive until its outcome is known. No automatic retries. */
export async function plannerMutation<T>(
  input: Record<string, unknown>,
  waitForRetry: () => Promise<void>,
): Promise<T> {
  const snapshot = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  for (;;) {
    try {
      return await plannerRequest<T>(snapshot);
    } catch (error) {
      if (
        !snapshot.requestId ||
        (error instanceof PlannerResponseError && !error.uncertain)
      )
        throw error;
      await waitForRetry();
    }
  }
}
