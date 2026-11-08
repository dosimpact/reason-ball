import * as R from "remeda";
import { z } from "zod";

// SDK 프로토콜 데이터를 해석합니다. React나 화면 상태를 변경하지 않습니다.
export type JsonRecord = Record<string, unknown>;

export function nodeUpdates(data: unknown): JsonRecord[] {
  return R.isPlainObject(data) ? R.pipe(data, R.values(), R.filter(R.isPlainObject)) : [];
}

export type AssistantDelta = { id: string; text: string };

// SDK 수신 경계에서 튜플의 필요한 필드만 검증합니다.
const messageTupleSchema = z.tuple([
  z.object({
    id: z.string().optional(),
    type: z.string().optional(),
    role: z.string().optional(),
    content: z.unknown(),
  }),
  z.object({
    message_id: z.string().optional(),
    tags: z.array(z.string()).nullish(),
  }),
]);

export function textContent(content: unknown): string {
  if (R.isString(content)) return content;

  if (!R.isArray(content)) return "";

  return R.pipe(
    content,
    R.map((block) => {
      if (R.isString(block)) return block;
      return R.isPlainObject(block) && block.type === "text" && R.isString(block.text) ? block.text : "";
    }),
    R.join(""),
  );
}

export function assistantDelta(data: unknown): AssistantDelta | null {
  const parsed = messageTupleSchema.safeParse(data);

  if (!parsed.success) return null;
  const [chunk, metadata] = parsed.data;

  if (!["ai", "AIMessageChunk", "assistant"].includes(chunk.type ?? chunk.role ?? "")) return null;
  if (metadata.tags?.includes("langsmith:nostream")) return null;

  // 기존 작업 UI 연결 ID가 있으면 사용하고, 기본은 스트림 메시지 ID입니다.
  const id = metadata.message_id || chunk.id;
  const text = textContent(chunk.content);
  return id && text ? { id, text } : null;
}
