import { CODE_LIMITS, validateCodeSource, type CodeExecutionResult } from "../model/code-execution";

export function executeCode(source: string, signal: AbortSignal): Promise<CodeExecutionResult> {
  validateCodeSource(source);
  return new Promise((resolve) => {
    if (signal.aborted) { resolve({ output: "", error: "실행을 중단했어요.", truncated: false }); return; }
    let worker: Worker;
    try { worker = new Worker(new URL("./code-execution.worker.ts", import.meta.url), { type: "module" }); }
    catch { resolve({ output: "", error: "이 브라우저에서 실행 환경을 시작하지 못했어요.", truncated: false }); return; }
    let settled = false;
    const fail = (error: string) => finish({ output: "", error, truncated: false });
    let timer = window.setTimeout(() => fail("실행 환경 준비 시간이 초과됐어요. 다시 실행해 주세요."), CODE_LIMITS.startupMs);
    function finish(result: CodeExecutionResult) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      worker.terminate();
      resolve(result);
    }
    const cancel = () => fail("실행을 중단했어요.");
    signal.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => fail("실행 환경에서 오류가 발생했어요. 코드를 확인하고 다시 실행해 주세요.");
    worker.onmessageerror = () => fail("실행 결과를 읽지 못했어요.");
    worker.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "ready") {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fail("실행 시간 제한을 초과하여 중단했어요."), CODE_LIMITS.executionMs + 1_000);
      } else if (event.data?.type === "result") {
        const result = event.data.result;
        if (typeof result?.output !== "string" || result.output.length > CODE_LIMITS.outputCharacters || typeof result.truncated !== "boolean" || (result.error !== undefined && typeof result.error !== "string")) {
          fail("실행 결과 형식이 올바르지 않아요.");
        } else finish(result);
      }
    };
    worker.postMessage({ source });
  });
}
