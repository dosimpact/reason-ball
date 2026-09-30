import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant, type QuickJSHandle } from "quickjs-emscripten-core";
import { appendCodeOutput, CODE_LIMITS, validateCodeSource, type CodeExecutionResult } from "../model/code-execution";

/** I/O boundary: owns the VM lifecycle, clock deadline and console bridge. No app APIs are exposed. */
export async function evaluateIsolatedJavaScript(source: string, onReady?: () => void): Promise<CodeExecutionResult> {
  validateCodeSource(source);
  const quickjs = await newQuickJSWASMModuleFromVariant(variant);
  const runtime = quickjs.newRuntime();
  runtime.setMemoryLimit(CODE_LIMITS.heapBytes);
  runtime.setMaxStackSize(CODE_LIMITS.stackBytes);
  const deadline = performance.now() + CODE_LIMITS.executionMs;
  runtime.setInterruptHandler(() => performance.now() >= deadline);
  const vm = runtime.newContext();
  let output = "";
  let truncated = false;
  let lines = 0;
  let error: string | undefined;

  function describe(handle: QuickJSHandle): string {
    const value: unknown = vm.dump(handle);
    if (typeof value === "string") return value;
    if (value instanceof Object) return JSON.stringify(value);
    return String(value);
  }
  function append(line: string) {
    if (lines++ >= CODE_LIMITS.outputLines) { truncated = true; return; }
    const next = appendCodeOutput(output, line);
    output = next.output;
    truncated ||= next.truncated;
  }
  function describeError(handle: QuickJSHandle) {
    return performance.now() >= deadline ? "실행 시간 제한(2초)을 초과했어요." : describe(handle).slice(0, 2_000);
  }

  try {
    const consoleObject = vm.newObject();
    const log = vm.newFunction("log", (...args) => {
      if (lines >= CODE_LIMITS.outputLines || output.length >= CODE_LIMITS.outputCharacters) { truncated = true; return vm.undefined; }
      append(args.slice(0, 20).map((arg) => describe(arg).slice(0, 4_000)).join(" "));
      if (args.length > 20) truncated = true;
      return vm.undefined;
    });
    for (const method of ["log", "info", "warn", "error", "debug"]) vm.setProp(consoleObject, method, log);
    vm.setProp(vm.global, "console", consoleObject);
    log.dispose();
    consoleObject.dispose();
    onReady?.();

    // Explicit global mode: no module loader, filesystem, fetch, DOM, storage, Node or host eval.
    const result = vm.evalCode(source, "artifact.js", { type: "global" });
    if (result.error) {
      try { error = describeError(result.error); } finally { result.error.dispose(); }
    } else {
      try {
        while (runtime.hasPendingJob() && performance.now() < deadline) {
          const jobs = runtime.executePendingJobs(1);
          if (jobs.error) {
            try { error = describeError(jobs.error); } finally { jobs.error.dispose(); }
            break;
          }
        }
        if (performance.now() >= deadline) error = "실행 시간 제한(2초)을 초과했어요.";
        if (!error) {
          const promise = vm.getPromiseState(result.value);
          if (promise.type === "pending") error = "완료되지 않은 Promise가 있어요. 외부 I/O와 타이머는 제공하지 않습니다.";
          else if (promise.type === "rejected") {
            try { error = describeError(promise.error); } finally { promise.error.dispose(); }
          } else if (promise.type === "fulfilled") {
            try { if (vm.typeof(promise.value) !== "undefined") append(describe(promise.value)); }
            finally { if (!promise.notAPromise) promise.value.dispose(); }
          }
        }
      } finally { result.value.dispose(); }
    }
  } catch {
    error = performance.now() >= deadline ? "실행 시간 제한(2초)을 초과했어요." : "코드 실행에 실패했어요. 메모리 제한 또는 잘못된 코드를 확인해 주세요.";
  } finally {
    vm.dispose();
    runtime.dispose();
  }
  return { output, error, truncated };
}
