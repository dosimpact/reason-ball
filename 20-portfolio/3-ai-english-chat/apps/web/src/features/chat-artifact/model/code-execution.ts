export const CODE_LIMITS = {
  sourceCharacters: 50_000,
  outputCharacters: 12_000,
  outputLines: 100,
  executionMs: 2_000,
  startupMs: 15_000,
  heapBytes: 16 * 1024 * 1024,
  stackBytes: 512 * 1024,
} as const;

export type CodeExecutionResult = { output: string; error?: string; truncated: boolean };

export function validateCodeSource(source: unknown): string {
  if (typeof source !== "string" || !source.trim()) throw new Error("실행할 JavaScript 코드를 입력해 주세요.");
  if (source.length > CODE_LIMITS.sourceCharacters) throw new Error("코드는 50,000자 이하로 입력해 주세요.");
  return source;
}

export function appendCodeOutput(current: string, line: string): { output: string; truncated: boolean } {
  const separator = current ? "\n" : "";
  const combined = current + separator + line;
  return { output: combined.slice(0, CODE_LIMITS.outputCharacters), truncated: combined.length > CODE_LIMITS.outputCharacters };
}
