import { z } from 'zod';
import { hasRasterImageSignature } from '@/shared/lib/image-signature';
import type { ModelCapabilities } from '@/shared/api/ai/model-catalog';

export const MAX_CHAT_FILE_BYTES = 2 * 1024 * 1024;

export function attachmentSelectionError(file: { type: string; size: number }, capabilities: Readonly<ModelCapabilities>): string | undefined {
  if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) return 'PNG, JPEG 또는 PDF 파일만 첨부할 수 있어요.';
  if (!Number.isInteger(file.size) || file.size <= 0) return '비어 있는 파일은 첨부할 수 없어요.';
  if (file.size > MAX_CHAT_FILE_BYTES) return '첨부 파일은 2MB 이하여야 해요.';
  const required = file.type.startsWith('image/') ? 'vision' : 'documents';
  if (capabilities[required] !== true) return '이 모델의 첨부 지원이 확인되지 않았어요. 지원 모델을 선택해 주세요.';
}
export const chatFileMimeSchema = z.enum(['image/png', 'image/jpeg', 'application/pdf']);
export type ChatFileMime = z.infer<typeof chatFileMimeSchema>;
const ids = z.object({ conversationId: z.uuid(), attachmentId: z.uuid() });
const referencePattern = /^chat-file:\/\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/;

export function chatFileReference(conversationId: string, attachmentId: string): string {
  const parsed = ids.parse({ conversationId, attachmentId });
  return `chat-file://${parsed.conversationId.toLowerCase()}/${parsed.attachmentId.toLowerCase()}`;
}

export function parseChatFileReference(value: string) {
  const match = referencePattern.exec(value);
  if (!match) throw new Error('A private chat file reference is required.');
  return ids.parse({ conversationId: match[1], attachmentId: match[2] });
}

export function chatFileDisplayUrl(value: string): string | undefined {
  if (value.startsWith('chat-file:')) {
    try {
      const { conversationId, attachmentId } = parseChatFileReference(value);
      return `/api/conversations/${conversationId}/attachments/${attachmentId}`;
    } catch { return undefined; }
  }
  // Legacy/mock parts remain displayable, but cannot be submitted to real AI.
  if (/^data:(image\/(png|jpeg)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}

export function validateChatFile(bytes: Uint8Array, mimeType: string): ChatFileMime {
  const mime = chatFileMimeSchema.parse(mimeType);
  if (bytes.length === 0 || bytes.length > MAX_CHAT_FILE_BYTES) throw new Error('Chat files must be between 1 byte and 2 MB.');
  const signature = mime === 'application/pdf'
    ? [37, 80, 68, 70, 45].every((byte, index) => bytes[index] === byte)
    : hasRasterImageSignature(bytes, mime);
  if (!signature) throw new Error('The file bytes do not match the declared format.');
  return mime;
}

export function chatFileStoragePath(ownerId: string, conversationId: string, digest: string, mimeType: ChatFileMime) {
  z.uuid().parse(ownerId); z.uuid().parse(conversationId);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid file digest.');
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' }[mimeType];
  return `${ownerId.toLowerCase()}/${conversationId.toLowerCase()}/${digest}.${extension}`;
}

export const storedChatFileSchema = z.object({
  type: z.literal('file'), url: z.string(), mediaType: chatFileMimeSchema,
  filename: z.string().min(1).max(500),
}).strict();

type FilePart = { type: 'file'; url: string; mediaType: string; filename?: string };

export function validateStoredChatFile(input: unknown, conversationId: string): FilePart {
  const part = storedChatFileSchema.parse(input);
  if (parseChatFileReference(part.url).conversationId !== conversationId.toLowerCase()) throw new Error('The uploaded file belongs to another conversation.');
  return part;
}

// Upload is an injected effect. Never mutate drafts or fetch arbitrary URLs.
export async function persistChatFiles<T extends { type: string }>(
  parts: readonly T[], conversationId: string,
  upload: (file: FilePart) => Promise<unknown>,
): Promise<Array<T | FilePart>> {
  if (parts.filter((part) => part.type === 'file').length > 4) throw new Error('A message can contain at most four files.');
  const result: Array<T | FilePart> = [];
  for (const part of parts) {
    if (part.type !== 'file') { result.push(part); continue; }
    const file = part as T & FilePart;
    if (file.url.startsWith('chat-file:')) {
      result.push(validateStoredChatFile({ type: 'file', url: file.url, mediaType: file.mediaType, filename: file.filename ?? 'attachment' }, conversationId));
    } else {
      if (!file.url.startsWith(`data:${file.mediaType};base64,`)) throw new Error('Reattach this file before sending it.');
      const stored = validateStoredChatFile(await upload(file), conversationId);
      if (stored.mediaType !== file.mediaType) throw new Error('The stored file type does not match the upload.');
      result.push(stored);
    }
  }
  return result;
}
