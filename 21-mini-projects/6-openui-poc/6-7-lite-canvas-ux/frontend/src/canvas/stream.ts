/** Incremental SSE decoding; UTF-8 and frames may be split at any byte. */
export async function consumeSse(response: Response, onEvent: (event: string, data: unknown) => void) {
  if (!response.body) throw new Error("응답 스트림이 없습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  function consume(final = false) {
    buffer = buffer.replace(/\r\n/g, "\n");
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length) {
        const value = data.join("\n");
        if (value !== "[DONE]") onEvent(event, JSON.parse(value));
      }
    }
    if (final && buffer.trim() && !buffer.trim().startsWith(":")) throw new Error("스트림이 중간에 끊겼습니다. 리포트를 다시 불러오세요.");
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      consume(done);
      if (done) break;
    }
  } finally { reader.releaseLock(); }
}
