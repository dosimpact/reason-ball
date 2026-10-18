export type Frame = {
  type: string;
  runId: string;
  sequence: number;
  widgetId?: string;
  channel?: "chat" | "canvas";
  [key: string]: unknown;
};
/** Incremental SSE decoding; an aborted run never applies later frames. */
export async function readFrames(
  response: Response,
  signal: AbortSignal,
  receive: (frame: Frame) => void,
) {
  if (!response.ok || !response.body)
    throw new Error("분석 서버에 연결하지 못했습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last = 0;
  let runId = "";
  let done = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (signal.aborted) return;
      buffer = (
        buffer + decoder.decode(chunk.value, { stream: !chunk.done })
      ).replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = event
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!data || done) continue;
        const frame = JSON.parse(data) as Frame;
        if (!runId) runId = frame.runId;
        if (frame.runId !== runId || frame.sequence <= last) continue;
        last = frame.sequence;
        receive(frame);
        if (frame.type === "done" || frame.type === "error") done = true;
      }
      if (chunk.done) break;
    }
    if (!done && !signal.aborted)
      throw new Error("연결이 중단됐습니다. 완료된 결과는 유지됩니다.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
