import { createHash } from 'node:crypto';

export function documentFromBytes(bytes: Buffer, contentType: string | null) {
  if (!bytes.length) throw new Error('SEC_DOCUMENT_EMPTY');
  const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (content.includes('\u0000')) throw new Error('SEC_DOCUMENT_NUL');
  return {
    documentContent: content,
    documentContentType: (contentType ?? 'application/octet-stream').slice(0, 128),
    documentSizeBytes: String(bytes.length),
    checksum: createHash('sha256').update(bytes).digest('hex'),
  };
}
