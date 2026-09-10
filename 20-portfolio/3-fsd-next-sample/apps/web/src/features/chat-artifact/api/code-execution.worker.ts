import { evaluateIsolatedJavaScript } from "./quickjs-execution";

// A fresh worker is created for each run and terminated after its single response.
self.onmessage = async (event: MessageEvent<{ source: string }>) => {
  try {
    const result = await evaluateIsolatedJavaScript(event.data.source, () => self.postMessage({ type: "ready" }));
    self.postMessage({ type: "result", result });
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 200) : "알 수 없는 초기화 오류";
    self.postMessage({ type: "result", result: { output: "", truncated: false, error: `실행 환경을 준비하지 못했어요. 코드는 유지됩니다. 다시 실행해 주세요. (${detail})` } });
  }
};
