/*
 * 브라우저의 AG-UI 요청을 Python LangGraph protocol v2 실행으로 연결합니다. JS 프록시가 임시 thread와 스트림 수명주기를 관리합니다.
 */
import { createLangChainStreamResponse } from "@openuidev/langchain";
import { NextRequest } from "next/server";
import { classifyIntent, type ChatMessage } from "@/reporting/intent-routing";
import { createReportResponse } from "@/reporting/report-response";

export const runtime = "nodejs";

/**
 * HTTP connection to the independently deployed Python LangGraph backend
 */
const API_URL = process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2036";
const ASSISTANT_ID = process.env.LANGGRAPH_ASSISTANT_ID || "agent";
const REPORT_ID = process.env.LANGGRAPH_REPORT_ASSISTANT_ID || "report";
const INTENT_ID = process.env.LANGGRAPH_INTENT_ASSISTANT_ID || "intent";

/**
 * Proxies the browser <-> LangGraph server. The browser posts native AG-UI
 * messages; {@link createLangChainStreamResponse} converts them to LangChain
 * messages, starts the graph over the protocol-v2 endpoints, and relays only
 * the custom OpenUI channel.
 */
export async function POST(req: NextRequest) {
  const generate = (assistantId: string) => (request: NextRequest) => createLangChainStreamResponse(request, {
    apiUrl: API_URL,
    assistantId,
    apiKey: process.env.LANGSMITH_API_KEY,
    debug: false,
  });
  let body;
  try { body = await req.clone().json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!Array.isArray(body?.messages) || !body.messages.every((message: ChatMessage) => message && typeof message.role === "string") || !body.messages.some((message: ChatMessage) => message?.role === "user" && typeof message.content === "string" && message.content.trim())) {
    return Response.json({ error: "A user message is required" }, { status: 400 });
  }
  try {
    const intent = await classifyIntent(body.messages, { apiUrl: API_URL, apiKey: process.env.LANGSMITH_API_KEY, assistantId: INTENT_ID, signal: req.signal });
    const response = intent.mode === "report"
      ? createReportResponse(req, body, generate(REPORT_ID), intent)
      : await generate(ASSISTANT_ID)(req);
    const headers = new Headers(response.headers);
    headers.set("X-UI-Intent", intent.mode);
    headers.set("X-UI-Intent-Source", intent.source);
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ error: error instanceof Error ? error.message : "요청 의도를 판단하지 못했습니다. 다시 시도해 주세요." }, { status: 503 });
  }
}
