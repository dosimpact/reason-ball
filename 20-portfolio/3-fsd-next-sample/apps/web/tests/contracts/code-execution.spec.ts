import { expect, test } from "@playwright/test";
import { appendCodeOutput, CODE_LIMITS, validateCodeSource } from "../../src/features/chat-artifact/model/code-execution";
import { evaluateIsolatedJavaScript } from "../../src/features/chat-artifact/api/quickjs-execution";

test("validates exact source and bounds output without changing inputs", () => {
  expect(validateCodeSource("  1 + 2 ")).toBe("  1 + 2 ");
  for (const source of [undefined, " ", "x".repeat(CODE_LIMITS.sourceCharacters + 1)]) expect(() => validateCodeSource(source)).toThrow();
  expect(appendCodeOutput("one", "two")).toEqual({ output: "one\ntwo", truncated: false });
  expect(appendCodeOutput("x".repeat(CODE_LIMITS.outputCharacters), "new")).toEqual({ output: "x".repeat(CODE_LIMITS.outputCharacters), truncated: true });
});

test("executes JavaScript functions, collections, console output and resolved promises", async () => {
  const result = await evaluateIsolatedJavaScript('const double = n => n * 2; console.log([1,2,3].map(double)); 7');
  expect(result.error).toBeUndefined();
  expect(result.output).toBe("[2,4,6]\n7");
  expect((await evaluateIsolatedJavaScript("Promise.resolve(42)")).output).toBe("42");
});

test("isolates runs and exposes no browser, Node, network or storage APIs", async () => {
  expect((await evaluateIsolatedJavaScript("globalThis.privateValue = 123")).error).toBeUndefined();
  expect((await evaluateIsolatedJavaScript("typeof privateValue")).output).toBe("undefined");
  const result = await evaluateIsolatedJavaScript("[typeof window, typeof document, typeof fetch, typeof localStorage, typeof process, typeof require, typeof WebSocket, typeof importScripts].join(',')");
  expect(result.output).toBe(Array(8).fill("undefined").join(","));
  expect((await evaluateIsolatedJavaScript("fetch('https://example.com')")).error).toContain("fetch");
  expect((await evaluateIsolatedJavaScript('console.log.constructor("return typeof fetch")()')).output).toBe("undefined");
});

test("preserves output on errors and bounds loops, allocations and excessive output", async () => {
  const failed = await evaluateIsolatedJavaScript('console.log("before"); throw new Error("sample failure")');
  expect(failed.output).toBe("before");
  expect(failed.error).toContain("sample failure");
  expect((await evaluateIsolatedJavaScript("const = ;")).error).toContain("SyntaxError");
  expect((await evaluateIsolatedJavaScript("while(true) {} ")).error).toContain("시간 제한");
  expect((await evaluateIsolatedJavaScript("new ArrayBuffer(64 * 1024 * 1024)")).error).toBeTruthy();
  const noisy = await evaluateIsolatedJavaScript('for (let i=0; i<200; i++) console.log("line", i);');
  expect(noisy.truncated).toBe(true);
  expect(noisy.output.split("\n")).toHaveLength(100);
  expect((await evaluateIsolatedJavaScript("Promise.reject(new Error('rejected'))")).error).toContain("rejected");
  expect((await evaluateIsolatedJavaScript("new Promise(() => {})")).error).toContain("Promise");
});
