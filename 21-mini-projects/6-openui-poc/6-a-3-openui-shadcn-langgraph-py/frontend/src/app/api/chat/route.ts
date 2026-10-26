/*
 * 브라우저의 AG-UI 요청을 Python LangGraph protocol v2 실행으로 연결합니다. JS 프록시가 임시 thread와 스트림 수명주기를 관리합니다.
 */
import { createLangChainStreamResponse } from "@openuidev/langchain";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * HTTP connection to the independently deployed Python LangGraph backend
 */
const API_URL = process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2038";
const ASSISTANT_ID = process.env.LANGGRAPH_ASSISTANT_ID || "agent";

/**
 * Proxies the browser <-> LangGraph server. The browser posts native AG-UI
 * messages; {@link createLangChainStreamResponse} converts them to LangChain
 * messages, starts the graph over the protocol-v2 endpoints, and relays only
 * the custom OpenUI channel.
 */
export async function POST(req: NextRequest) {
  return createLangChainStreamResponse(req, {
    apiUrl: API_URL,
    assistantId: ASSISTANT_ID,
    apiKey: process.env.LANGSMITH_API_KEY,
    debug: process.env.NODE_ENV !== "production",
  });
}
