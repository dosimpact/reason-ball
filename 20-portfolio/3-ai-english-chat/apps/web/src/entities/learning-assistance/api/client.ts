import { assistanceRequestSchema, assistanceResponseSchema, type AssistanceRequest } from "../model/assistance";

export async function requestAssistance(input: AssistanceRequest, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  const request = assistanceRequestSchema.parse(input);
  const response = await fetcher("/api/ai/learning-assistance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal });
  if (!response.ok) throw new Error("학습 도움말을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
  const result = assistanceResponseSchema.parse(await response.json());
  if (result.messageId !== request.messageId || result.mode !== request.mode) throw new Error("다른 메시지의 도움말을 표시하지 않았습니다.");
  return result;
}
