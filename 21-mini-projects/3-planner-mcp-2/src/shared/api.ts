export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(response.status, result.error ?? "요청 실패");
  return result;
}

export function missingAs<T>(fallback: T) {
  return (error: unknown): T => {
    if (error instanceof ApiError && error.status === 404) return fallback;
    throw error;
  };
}
