const base = `${process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") ?? ""}/api/remote-proxy/api/sec/modeling`;
export async function modelingRequest<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(`${base}/${path}`, {
    signal, cache: "no-store", method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message ?? data?.detail;
    throw new Error(typeof message === "string" ? message : message ? JSON.stringify(message) : `모델링 API 요청 실패 (${response.status})`);
  }
  return data as T;
}
