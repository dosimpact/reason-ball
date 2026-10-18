import { NextRequest } from "next/server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const response = await fetch(
      `${process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2037"}/canvas/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await request.text(),
        signal: request.signal,
      },
    );
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: "조회 서버에 연결할 수 없습니다. 마지막 정상 결과를 표시합니다.",
      },
      { status: 502 },
    );
  }
}
