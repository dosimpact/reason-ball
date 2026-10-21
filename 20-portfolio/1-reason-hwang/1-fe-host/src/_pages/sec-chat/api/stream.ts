import { createParser } from "@openuidev/lang-core";
import { library } from "@/shared/ui/intelligent-ui";
import type { Evidence } from "../ui/EvidenceView";
import type { Activity } from "../ui/ActivityTimeline";

type StreamEvent = { type: string; name?: string; message?: string; delta?: string; value?: Record<string, unknown> };
type ActivityHandler = (activity: Activity) => void;

function reportActivity(event: StreamEvent, onActivity?: ActivityHandler) {
  if (event.type !== "CUSTOM" || event.name !== "sec.activity" || !event.value) return;
  const { id, label, status, kind } = event.value;
  if (typeof id === "string" && typeof label === "string" && ["running", "completed", "failed", "cancelled", "unavailable"].includes(String(status)) && (kind === "node" || kind === "request")) {
    onActivity?.({ id, label, status: status as Activity["status"], kind });
  }
}

async function checkResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(typeof error.detail === "string" ? error.detail : "질문을 처리할 수 없습니다.");
  }
}

async function* readEvents(response: Response, onActivity?: ActivityHandler): AsyncGenerator<StreamEvent> {
  await checkResponse(response);
  if (!response.body) throw new Error("응답 스트림이 없습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (done && buffer) lines.push(buffer);
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const event: StreamEvent = JSON.parse(line.slice(6));
        reportActivity(event, onActivity);
        if (event.type === "RUN_ERROR") throw new Error(event.message ?? "답변 생성에 실패했습니다.");
        yield event;
      }
      if (done) break;
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
}

export async function readResolution<T>(response: Response, onActivity: ActivityHandler): Promise<T> {
  await checkResponse(response);
  // Preserve JSON clients and controlled test fixtures; live chat requests SSE.
  if (!response.headers.get("content-type")?.includes("text/event-stream")) return response.json();
  let result: Record<string, unknown> | undefined;
  let finished = false;
  for await (const event of readEvents(response, onActivity)) {
    if (event.type === "CUSTOM" && event.name === "sec.resolution") result = event.value;
    if (event.type === "RUN_FINISHED") finished = true;
  }
  if (!finished || !result) throw new Error("메시지 처리가 완료되기 전에 연결이 끊겼습니다.");
  if (typeof result.program === "string") validateProgram(result.program);
  return result as T;
}

/** Validate the completed program while forwarding live execution status. */
export async function readAnswer(response: Response, onActivity?: ActivityHandler): Promise<{ program: string; followUps: string[]; evidence?: Evidence }> {
  let evidence: Evidence | undefined;
  let followUps: string[] = [];
  let program = "", finished = false;
  for await (const event of readEvents(response, onActivity)) {
    if (event.type === "TEXT_MESSAGE_CONTENT") program += event.delta ?? "";
    if (event.type === "CUSTOM" && event.name === "sec.follow-ups" && Array.isArray(event.value?.questions)) {
      followUps = event.value.questions.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 160).slice(0, 3);
    }
    if (event.type === "CUSTOM" && event.name === "sec.evidence") evidence = event.value as unknown as Evidence;
    if (event.type === "RUN_FINISHED") finished = true;
  }
  if (!finished || !program) throw new Error("답변이 완료되기 전에 연결이 끊겼습니다.");
  validateProgram(program);
  return { program, followUps, evidence };
}

function validateProgram(program: string) {
  const parsed = createParser(library.toJSONSchema(), library.root).parse(program);
  if (!parsed.root || parsed.meta.incomplete || parsed.meta.errors.length || parsed.meta.unresolved.length) {
    throw new Error("Intelligent UI 답변 형식 검증에 실패했습니다.");
  }
}
