import { z } from 'zod';
import type { ChatConversation, ChatMessage } from './types';

const partsSchema = z.array(z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1).max(32_000) }),
  z.object({ type: z.literal('file'), url: z.string().min(1).max(3_000_000), mediaType: z.string().min(1).max(200), filename: z.string().max(500).optional() }),
])).min(1).max(20).refine((parts) => parts.some((part) => part.type === 'text'));
export const outboxSchema = z.object({
  version: z.literal(1), conversationId: z.string().min(1), userMessageId: z.string().min(1).max(200),
  parts: partsSchema, modelId: z.string().min(1).max(100), startedAt: z.iso.datetime(),
  baseUpdatedAt: z.string().min(1), baseTailId: z.string().nullable(),
  preserveDraft: z.boolean().optional(),
}).strict();
export type ChatOutbox = z.infer<typeof outboxSchema>;

export function draftAfterTransmission(draft: string, entry: ChatOutbox): string {
  if (entry.preserveDraft) return draft;
  const submitted = entry.parts.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
  return draft.trim() === submitted ? '' : draft;
}

export function prepareOutbox(conversation: ChatConversation, message: ChatMessage, modelId: string, startedAt: string, options: { preserveDraft?: boolean } = {}): ChatOutbox {
  if (message.role !== 'user') throw new Error('사용자 메시지만 재전송할 수 있어요.');
  return outboxSchema.parse({ version: 1, conversationId: conversation.id, userMessageId: message.id,
    parts: message.parts, modelId, startedAt, ...(options.preserveDraft !== undefined ? { preserveDraft: options.preserveDraft } : {}), baseUpdatedAt: conversation.updatedAt, baseTailId: conversation.messages.at(-1)?.id ?? null });
}

export function reconcileOutbox(conversation: ChatConversation, entry: ChatOutbox): { stored: boolean; conversation: ChatConversation } {
  if (entry.conversationId !== conversation.id) throw new Error('전송 기록의 대화가 일치하지 않아요.');
  const stored = conversation.messages.find((message) => message.id === entry.userMessageId);
  if (stored) {
    if (stored.role !== 'user' || JSON.stringify(partsSchema.parse(stored.parts)) !== JSON.stringify(entry.parts)) {
      throw new Error('같은 메시지 ID의 저장 내용이 달라 자동 재전송하지 않았어요.');
    }
    return { stored: true, conversation };
  }
  if (conversation.updatedAt !== entry.baseUpdatedAt || (conversation.messages.at(-1)?.id ?? null) !== entry.baseTailId) {
    throw new Error('전송 이후 대화가 변경됐어요. 로컬 전송 내용을 확인한 뒤 계속해 주세요.');
  }
  return { stored: false, conversation: { ...conversation, modelId: entry.modelId,
    messages: [...conversation.messages, { id: entry.userMessageId, role: 'user', parts: entry.parts }],
    pendingRequest: { userMessageId: entry.userMessageId, startedAt: entry.startedAt } } };
}
