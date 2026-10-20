import { createParser } from "@openuidev/lang-core";
import { library } from "./intelligent-ui/library";

/** AG-UI 이벤트를 끝까지 확인한 뒤 검증된 OpenUI 프로그램만 화면에 넘긴다. */
export async function readAnswer(response: Response): Promise<string> {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(typeof error.detail === "string" ? error.detail : "질문을 처리할 수 없습니다.");
  }
  if (!response.body) throw new Error("응답 스트림이 없습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", program = "", finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === "RUN_ERROR") throw new Error(event.message);
        if (event.type === "TEXT_MESSAGE_CONTENT") program += event.delta;
        if (event.type === "RUN_FINISHED") finished = true;
      }
      if (done) break;
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  if (!finished || !program) throw new Error("답변이 완료되기 전에 연결이 끊겼습니다.");
  const parsed = createParser(library.toJSONSchema(), library.root).parse(program);
  if (!parsed.root || parsed.meta.incomplete || parsed.meta.errors.length || parsed.meta.unresolved.length) {
    throw new Error("Intelligent UI 답변 형식 검증에 실패했습니다.");
  }
  return program;
}
