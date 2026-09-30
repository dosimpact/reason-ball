import { turnEvaluationRequestSchema, turnEvaluationResponseSchema, type TurnEvaluationRequest } from "../model/turn-evaluation";

export async function requestTurnEvaluation(input: TurnEvaluationRequest, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  const request = turnEvaluationRequestSchema.parse(input);
  const response = await fetcher("/api/ai/turn-evaluation", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal,
  });
  if (!response.ok) {
    throw new Error(response.status === 409 ? "대화가 바뀌었어요. 다시 불러온 뒤 평가해 주세요." : "발화를 평가하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  return turnEvaluationResponseSchema.parse(await response.json());
}
