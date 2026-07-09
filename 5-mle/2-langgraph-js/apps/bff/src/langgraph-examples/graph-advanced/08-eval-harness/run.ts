import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createLlm } from "../../common/llm.js";
import { evaluateOutputs, extractAnswerText, type EvalReport, type JudgeResult } from "./eval.js";
import { GOLDEN_DATASET, type GoldenDatasetRow } from "./golden-dataset.js";
import { graph } from "./graph.js";

export const JUDGE_SYSTEM_PROMPT =
  "You are a strict evaluator. Score the assistant response on a 1-5 integer scale " +
  "(5 = perfect, 1 = wrong/empty). Consider correctness, presence of expected keywords, " +
  'and helpful tone. Reply ONLY in JSON: {"score": <int 1-5>, "reason": "<short reason>"}';

export function parseJudgeResponse(text: string): JudgeResult {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<JudgeResult>;
    const score = typeof parsed.score === "number" ? parsed.score : null;
    return {
      score,
      reason: typeof parsed.reason === "string" ? parsed.reason : "missing reason"
    };
  } catch {
    return {
      score: null,
      reason: `failed to parse judge response: ${text.slice(0, 200)}`
    };
  }
}

export async function llmJudge(
  question: string,
  answer: string,
  expectedKeywords: readonly string[]
): Promise<JudgeResult> {
  const llm = createLlm("fast");
  const response = await llm.invoke([
    new SystemMessage(JUDGE_SYSTEM_PROMPT),
    new HumanMessage(
      [
        `Question: ${question}`,
        `Expected keywords (must appear): ${JSON.stringify(expectedKeywords)}`,
        `Assistant answer:\n${answer}`,
        "",
        "Respond with JSON only."
      ].join("\n")
    )
  ]);

  return parseJudgeResponse(extractAnswerText(response));
}

export async function evaluateGraph(
  dataset: readonly GoldenDatasetRow[] = GOLDEN_DATASET,
  options: {
    useJudge?: boolean;
    timestamp?: string;
  } = {}
): Promise<EvalReport> {
  const inputs = dataset.map((row) => ({
    messages: [new HumanMessage(row.input)]
  }));
  const outputs = await graph.batch(inputs);

  if (!options.useJudge) {
    return evaluateOutputs(dataset, outputs, {
      timestamp: options.timestamp
    });
  }

  const preliminary = evaluateOutputs(dataset, outputs, {
    timestamp: options.timestamp
  });
  const judgeEntries = await Promise.all(
    preliminary.rows.map(async (row) => [row.id, await llmJudge(row.input, row.answer, row.expectedKeywords)] as const)
  );

  return evaluateOutputs(dataset, outputs, {
    useJudge: true,
    judgeResults: Object.fromEntries(judgeEntries),
    timestamp: options.timestamp
  });
}
