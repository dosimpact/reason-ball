import { NextRequest } from "next/server";
import { insightExpression, reportProblems } from "./validate-report";
import { buildVendorReport, reportSource } from "./vendor-report";
import type { Intent } from "./intent-routing";

type Event = { type: string; delta?: string; message?: string; [key: string]: unknown };
type TranscriptMessage = { id?: string; role: string; content?: unknown };
type Generate = (request: NextRequest) => Promise<Response>;

async function readEvents(response: Response): Promise<Event[]> {
  if (!response.ok) throw new Error(`보고서 생성 요청이 실패했습니다 (HTTP ${response.status}).`);
  const text = await response.text();
  const events = text.split(/\r?\n/).filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)) as Event);
  const error = events.find((event) => event.type === "RUN_ERROR");
  if (error) throw new Error(String(error.message ?? "모델 실행이 실패했습니다."));
  if (!events.some((event) => event.type === "RUN_FINISHED")) throw new Error("보고서 생성 스트림이 완료되지 않았습니다.");
  return events;
}

/** Buffer only reports so malformed or table-only programs never become saved answers. */
export function createReportResponse(request: NextRequest, body: { messages: TranscriptMessage[]; [key: string]: unknown }, generate: Generate, intent: Intent = { mode: "report", source: "latest" }): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  request.signal.addEventListener("abort", onAbort, { once: true });
  if (request.signal.aborted) abort.abort();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Event) => { if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
      const runId = crypto.randomUUID();
      let rejected: { program: string; problems: string[] } | undefined;
      send({ type: "RUN_STARTED", threadId: "report", runId });
      heartbeat = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(": generating and validating report\n\n")); }, 10_000);
      try {
        const deliver = (program: string) => {
          const messageId = crypto.randomUUID();
          send({ type: "TEXT_MESSAGE_START", messageId, role: "assistant" });
          send({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: program });
          send({ type: "TEXT_MESSAGE_END", messageId });
          send({ type: "RUN_FINISHED", threadId: "report", runId });
        };
        const sourceMessages = intent.source === "none" ? [] : intent.sourceMessageId
          ? body.messages.filter((message, index) => (message.id ?? `message-${index}`) === intent.sourceMessageId)
          : intent.source === "latest" ? body.messages.filter(message => message.role === "user").slice(-1) : body.messages;
        const vendorSource = reportSource(sourceMessages);
        const scaffold = vendorSource ? buildVendorReport(vendorSource) : null;
        if (scaffold && vendorSource) {
          let finalProgram = scaffold;
          let enriched = false;
          let enrichmentError: string | undefined;
          try {
            const focus = body.messages.filter((message) => message.role === "user").at(-1)?.content;
            const content = `[보고서 해설 생성]\n원문에 근거한 한국어 해설 카드 세 개만 생성하세요. KPI, 차트, 필터, 조치 목록과 원문 근거는 앱이 이미 만들었습니다. root = Col([Card(...), Card(...), Card(...)]) 단일 인라인 할당만 반환하세요. 변수나 함수는 사용하지 마세요. 각 카드에 Title(md), Text(sm), Caption(출처 섹션)을 사용하세요. 카드 제목은 핵심 해석, 우선 확인, 다음 조치입니다. 새 수치나 원인, 미지원 권고를 만들어내지 마세요.\n\n요청 맥락:\n${String(focus ?? "").split("<report-source>")[0]}\n\n<report-source>\n${vendorSource}\n</report-source>`;
            const input = new NextRequest(request.url, { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: [{ id: crypto.randomUUID(), role: "user", content }] }),
              signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45_000)]) });
            const events = await readEvents(await generate(input));
            const generated = events.filter((event) => event.type === "TEXT_MESSAGE_CONTENT").map((event) => event.delta ?? "").join("");
            const expression = insightExpression(generated, scaffold.includes("현재 예산과 추천 예산이 같은 행이 있습니다"));
            if (!expression || events.some((event) => event.type === "TOOL_CALL_START")) throw new Error("AI 해설의 구성 검증을 통과하지 못했습니다.");
            finalProgram = scaffold.replace(", stockChart])", ", stockChart, aiInsights])")
              + `\naiInsights = Col([Title("AI 해설", "lg"), Caption("아래 해석은 모델 생성 · 수치와 차트는 원문 구조에서 추출"), ${expression}])`;
            enriched = true;
          } catch (error) {
            if (abort.signal.aborted) throw error;
            enrichmentError = error instanceof Error ? error.message : "AI 해설을 불러오지 못했습니다.";
            finalProgram = scaffold.replace(", stockChart])", ", stockChart, enrichmentNotice])")
              + '\nenrichmentNotice = Card([Title("원문 기반 보고서", "md"), Text("AI 해설을 불러오지 못해 원문 지표·차트·근거로 구성한 보고서를 표시합니다.", "sm", "muted")], "soft")';
          }
          const problems = reportProblems(finalProgram, vendorSource);
          if (problems.length) throw new Error(`원문 보고서 구성 오류: ${problems.join("; ")}`);
          send({ type: "CUSTOM", name: "report_generation", value: { strategy: enriched ? "source_scaffold_with_ai" : "source_scaffold", ...(enrichmentError ? { enrichmentError } : {}) } });
          deliver(finalProgram);
          return;
        }
        let messages = body.messages;
        for (let attempt = 0; attempt < 2; attempt++) {
          const input = new NextRequest(request.url, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, messages }), signal: abort.signal });
          const events = await readEvents(await generate(input));
          const program = events.filter((event) => event.type === "TEXT_MESSAGE_CONTENT").map((event) => event.delta ?? "").join("");
          const source = sourceMessages.map((message) => String(message.content ?? "")).join("\n");
          const problems = reportProblems(program, source, "general");
          rejected = problems.length ? { program, problems } : undefined;
          if (problems.length) console.warn(`[report-validation] attempt ${attempt + 1}: ${problems.join("; ")}`);
          if (problems.length === 0) {
            send({ type: "CUSTOM", name: "report_generation", value: { strategy: "model_report" } });
            deliver(program);
            return;
          }
          if (attempt === 1) throw new Error("보고서 구성을 완성하지 못했습니다. 새 대화에서 다시 생성해 주세요.");
          messages = [...messages, { id: crypto.randomUUID(), role: "assistant", content: program },
            { id: crypto.randomUUID(), role: "user", content: `The report failed catalog/composition validation. Return one corrected COMPLETE OpenUI program preserving supplied facts. Do not explain. Fix:\n${problems.join("\n")}\nPrefer simple Col([Title(...), Card([Title(...), Text(...)]), ...]) with at least three titled sections, two Cards and explanatory Text, all continuously visible. Replace invalid lists/functions with ordinary Text where possible. If using List, pass ListItem(title, description) components, never raw strings. A literal array does not need Concat; @Concat requires TWO arguments. Quote non-ASCII keys and keep expressions on one line. Adapt to the topic; do not invent vendor charts, numbers or sources to fill space.` }];
        }
      } catch (error) {
        if (!abort.signal.aborted) send({ type: "RUN_ERROR", message: error instanceof Error ? error.message : "보고서를 생성하지 못했습니다.", ...(rejected ? { details: rejected } : {}) });
      } finally {
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", onAbort);
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; clearInterval(heartbeat); abort.abort(); request.signal.removeEventListener("abort", onAbort); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
