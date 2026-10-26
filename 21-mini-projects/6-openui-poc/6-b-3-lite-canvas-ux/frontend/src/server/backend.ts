import "server-only";

export const backendUrl = process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2040";
export function backendHeaders() {
  return { "Content-Type": "application/json", ...(process.env.LANGSMITH_API_KEY ? { "x-api-key": process.env.LANGSMITH_API_KEY } : {}) };
}
// 백엔드 주소와 인증 헤더는 서버에서만 조합하며 생성 상태가 오래 캐시되지 않도록 매번 조회합니다.
export async function backendFetch(path: string, init: RequestInit = {}) {
  return fetch(`${backendUrl}${path}`, { ...init, headers: { ...backendHeaders(), ...init.headers }, cache: "no-store" });
}
export async function proxyJson(path: string, method = "GET") {
  try {
    const response = await backendFetch(path, { method });
    return new Response(await response.text(), { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "리포트 서버에 연결하지 못했습니다." }, { status: 502 });
  }
}
export const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
