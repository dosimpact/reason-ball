import { createParser } from "@openuidev/lang-core";
import { OpenuiSystemPromptSpec as spec } from "@/shared/config";

export type UIOutput = { program: string; controls: string; revision: number };
export type Activity = { id: string; label: string; status: string };

export async function readOutput(response: Response, onActivity: (value: Activity) => void): Promise<UIOutput> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "요청을 처리할 수 없습니다.");
  }
  if (!response.body) throw new Error("응답 스트림이 없습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", finished = false;
  let output: UIOutput | undefined;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (done && buffer) lines.push(buffer);
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === "RUN_ERROR") throw new Error(event.message ?? "생성에 실패했습니다.");
        if (event.type === "RUN_FINISHED") finished = true;
        if (event.type === "CUSTOM" && event.name === "ui.activity") onActivity(event.value);
        if (event.type === "CUSTOM" && event.name === "ui.output") output = event.value;
      }
      if (done) break;
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  if (!finished || !output || !Number.isInteger(output.revision) || output.revision < 1) throw new Error("완료 전에 연결이 끊겼습니다. 다시 시도해 주세요.");
  for (const program of [output.program, output.controls]) {
    if (typeof program !== "string") throw new Error("잘못된 화면 응답입니다.");
    if (!program) continue;
    const parsed = createParser(spec.schema, spec.root).parse(program);
    if (!parsed.root || parsed.meta.errors.length || parsed.meta.unresolved.length || parsed.meta.incomplete) throw new Error("화면 형식 검증에 실패했습니다.");
  }
  return output;
}
