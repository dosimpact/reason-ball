import { StreamEvent } from "./model";

export async function readEvents(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.ok) throw new Error(`요청 실패 (HTTP ${response.status})`);
  if (!response.body) throw new Error("응답 스트림이 없습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = frame.split("\n").find((line) => line.startsWith("event: "))?.slice(7);
        const data = frame.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
        if (event && data) {
          onEvent({ event, data: JSON.parse(data) });
          completed ||= event === "done" || event === "error";
        }
      }
      if (done) break;
    }
    if (!completed) throw new Error("완료 전에 연결이 종료됐습니다.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
