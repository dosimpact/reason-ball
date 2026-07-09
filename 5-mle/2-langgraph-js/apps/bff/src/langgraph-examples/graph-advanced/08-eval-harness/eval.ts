import type { GoldenDatasetRow } from "./golden-dataset.js";

export interface EvalGraphOutput {
  messages?: readonly unknown[];
}

export interface JudgeResult {
  score: number | null;
  reason: string;
}

export interface EvalCaseResult {
  id: string;
  input: string;
  answer: string;
  expectedKeywords: readonly string[];
  expectedToolCalls: readonly string[];
  actualToolCalls: string[];
  ruleBased: boolean;
  toolTrace: boolean;
  judgeScore: number | null;
  judgeReason: string;
  pass: boolean;
}

export interface EvalSummary {
  total: number;
  pass: number;
  fail: number;
  ruleBasedPass: number;
  toolTracePass: number;
  avgJudgeScore: number | null;
  useJudge: boolean;
  timestamp: string;
}

export interface EvalReport {
  summary: EvalSummary;
  rows: EvalCaseResult[];
}

export interface EvaluateOutputsOptions {
  useJudge?: boolean;
  judgeResults?: Readonly<Record<string, JudgeResult>>;
  minimumJudgeScore?: number;
  timestamp?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function contentPartToText(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  if (!isRecord(part)) {
    return String(part);
  }

  if (typeof part.text === "string") {
    return part.text;
  }
  if (typeof part.content === "string") {
    return part.content;
  }
  return JSON.stringify(part);
}

export function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(contentPartToText).filter(Boolean).join(" ").trim();
  }
  if (content === null || content === undefined) {
    return "";
  }
  return String(content);
}

export function extractAnswerText(message: unknown): string {
  if (!isRecord(message)) {
    return "";
  }
  if ("content" in message) {
    return contentToText(message.content);
  }
  if (typeof message.text === "string") {
    return message.text;
  }
  return "";
}

function toolCallName(toolCall: unknown): string | undefined {
  if (!isRecord(toolCall)) {
    return undefined;
  }
  if (typeof toolCall.name === "string") {
    return toolCall.name;
  }

  const fn = toolCall.function;
  if (isRecord(fn) && typeof fn.name === "string") {
    return fn.name;
  }

  return undefined;
}

function collectFromToolCalls(toolCalls: unknown): string[] {
  if (!Array.isArray(toolCalls)) {
    return [];
  }
  return toolCalls.map(toolCallName).filter((name): name is string => Boolean(name));
}

export function collectToolCalls(messages: readonly unknown[]): string[] {
  return messages.flatMap((message) => {
    if (!isRecord(message)) {
      return [];
    }

    const directCalls = collectFromToolCalls(message.tool_calls);
    if (directCalls.length > 0) {
      return directCalls;
    }

    const additionalKwargs = message.additional_kwargs;
    if (isRecord(additionalKwargs)) {
      return collectFromToolCalls(additionalKwargs.tool_calls);
    }

    return [];
  });
}

export function ruleBasedCheck(answer: string, expectedKeywords: readonly string[]): boolean {
  if (expectedKeywords.length === 0) {
    return true;
  }

  const normalized = answer.toLowerCase();
  return expectedKeywords.every((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function toolTraceCheck(actual: readonly string[], expected: readonly string[]): boolean {
  const actualSet = new Set(actual);
  return expected.every((toolName) => actualSet.has(toolName));
}

function outputMessages(output: unknown): readonly unknown[] {
  if (isRecord(output) && Array.isArray(output.messages)) {
    return output.messages;
  }
  return [];
}

function avgJudgeScore(rows: readonly EvalCaseResult[], useJudge: boolean): number | null {
  if (!useJudge || rows.length === 0) {
    return null;
  }

  const scores = rows
    .map((row) => row.judgeScore)
    .filter((score): score is number => typeof score === "number");
  if (scores.length === 0) {
    return null;
  }

  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(3));
}

export function evaluateOutputs(
  dataset: readonly GoldenDatasetRow[],
  outputs: readonly EvalGraphOutput[],
  options: EvaluateOutputsOptions = {}
): EvalReport {
  const useJudge = options.useJudge ?? false;
  const minimumJudgeScore = options.minimumJudgeScore ?? 4;

  const rows = dataset.map((row, index): EvalCaseResult => {
    const messages = outputMessages(outputs[index]);
    const answer = extractAnswerText(messages.at(-1));
    const actualToolCalls = collectToolCalls(messages);
    const ruleBased = ruleBasedCheck(answer, row.expectedKeywords);
    const toolTrace = toolTraceCheck(actualToolCalls, row.expectedToolCalls);
    const judge = options.judgeResults?.[row.id] ?? { score: null, reason: "skipped" };
    const judgePass = !useJudge || (typeof judge.score === "number" && judge.score >= minimumJudgeScore);

    return {
      id: row.id,
      input: row.input,
      answer,
      expectedKeywords: row.expectedKeywords,
      expectedToolCalls: row.expectedToolCalls,
      actualToolCalls,
      ruleBased,
      toolTrace,
      judgeScore: judge.score,
      judgeReason: judge.reason,
      pass: ruleBased && toolTrace && judgePass
    };
  });

  return {
    summary: {
      total: rows.length,
      pass: rows.filter((row) => row.pass).length,
      fail: rows.filter((row) => !row.pass).length,
      ruleBasedPass: rows.filter((row) => row.ruleBased).length,
      toolTracePass: rows.filter((row) => row.toolTrace).length,
      avgJudgeScore: avgJudgeScore(rows, useJudge),
      useJudge,
      timestamp: options.timestamp ?? new Date().toISOString()
    },
    rows
  };
}
