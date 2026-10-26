/*
 * Next.js와 Python 사이의 공통 HTTP 중계입니다. 요청 취소와 스트림을 전달하고, 데이터·모델 처리는 Python에 맡깁니다.
 */
/** Next.js only relays HTTP; all document and conversation state belongs to Python. */
export async function relay(request: Request, path: string) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    // Next.js may normalize request.url to localhost; compare the browser-facing Host.
    const expected = new URL(request.url);
    expected.host = request.headers.get("host") ?? expected.host;
    if (origin && origin !== expected.origin) {
      return Response.json({ error: "Origin is not allowed" }, { status: 403 });
    }
  }
  const base = process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2041";
  const headers = new Headers({ "Content-Type": "application/json" });
  if (process.env.LANGSMITH_API_KEY) headers.set("x-api-key", process.env.LANGSMITH_API_KEY);
  try {
    const response = await fetch(`${base}/comparison/${path}`, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.text(),
      signal: request.signal,
      cache: "no-store",
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch {
    return Response.json({ error: "Python backend is unavailable" }, { status: 502 });
  }
}
