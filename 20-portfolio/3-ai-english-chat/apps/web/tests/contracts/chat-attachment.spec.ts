import { expect, test } from '@playwright/test';
import { chatFileDisplayUrl, chatFileReference, chatFileStoragePath, MAX_CHAT_FILE_BYTES, parseChatFileReference, persistChatFiles, validateChatFile, validateStoredChatFile } from '../../src/entities/chat/model/attachment';
import { createHttpChatRepository } from '../../src/entities/chat/api/http-chat-repository';

const conversationId = '50000000-0000-4000-8000-000000000001';
const attachmentId = '51000000-0000-4000-8000-000000000001';
const other = '50000000-0000-4000-8000-000000000002';
const url = chatFileReference(conversationId, attachmentId);
const stored = { type: 'file' as const, url, mediaType: 'image/png', filename: 'key.png' };
const raw = { ...stored, url: 'data:image/png;base64,iVBORw0KGgo=', size: 8 };

test('creates canonical scoped references and safe browser URLs', () => {
  expect(parseChatFileReference(url)).toEqual({ conversationId, attachmentId });
  expect(chatFileDisplayUrl(url)).toBe(`/api/conversations/${conversationId}/attachments/${attachmentId}`);
  expect(chatFileDisplayUrl(raw.url)).toBe(raw.url);
  expect(chatFileDisplayUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  expect(chatFileDisplayUrl('javascript:alert(1)')).toBeUndefined();
  expect(chatFileDisplayUrl('chat-file://bad')).toBeUndefined();
  for (const value of [url + '?token=secret', url + '/..', 'https://example.com/file', url.replace(conversationId, 'bad')]) expect(() => parseChatFileReference(value)).toThrow();
  expect(() => chatFileReference('bad', attachmentId)).toThrow();
});

test('validates supported signatures and byte limits without claiming malware detection', () => {
  const png = new Uint8Array([137,80,78,71,13,10,26,10]);
  expect(validateChatFile(png, 'image/png')).toBe('image/png');
  expect(validateChatFile(new Uint8Array([255,216,255]), 'image/jpeg')).toBe('image/jpeg');
  expect(validateChatFile(new TextEncoder().encode('%PDF-1.7'), 'application/pdf')).toBe('application/pdf');
  const maximum = new Uint8Array(MAX_CHAT_FILE_BYTES); maximum.set(png);
  expect(validateChatFile(maximum, 'image/png')).toBe('image/png');
  for (const [bytes, mime] of [[new Uint8Array(), 'image/png'], [new Uint8Array(MAX_CHAT_FILE_BYTES + 1), 'image/png'], [png, 'application/pdf'], [png, 'image/svg+xml']] as const) expect(() => validateChatFile(bytes, mime)).toThrow();
  expect([...png]).toEqual([137,80,78,71,13,10,26,10]);
});

test('scopes content-addressed keys and validates returned private references', () => {
  expect(chatFileStoragePath(other, conversationId, 'a'.repeat(64), 'image/png')).toBe(`${other}/${conversationId}/${'a'.repeat(64)}.png`);
  expect(() => chatFileStoragePath(other, conversationId, '../bad', 'image/png')).toThrow();
  expect(chatFileStoragePath('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', conversationId, 'a'.repeat(64), 'image/png')).toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/');
  expect(validateStoredChatFile(stored, conversationId)).toEqual(stored);
  expect(() => validateStoredChatFile(stored, other)).toThrow();
  expect(() => validateStoredChatFile({ ...stored, url: 'https://example.com/signed' }, conversationId)).toThrow();
  expect(() => validateStoredChatFile({ ...stored, mediaType: 'image/svg+xml' }, conversationId)).toThrow();
});

test('uploads before replacing inline parts and reuses durable references on retry', async () => {
  let calls = 0;
  const parts = [{ type: 'text', text: 'Describe it' }, raw];
  const result = await persistChatFiles(parts, conversationId, async () => { calls++; return stored; });
  expect(result).toEqual([parts[0], stored]);
  expect(parts[1]).toBe(raw);
  expect(await persistChatFiles(result, conversationId, async () => { throw new Error('Must not upload again'); })).toEqual(result);
  expect(calls).toBe(1);
  expect(await persistChatFiles([], conversationId, async () => null)).toEqual([]);
});

test('preserves caller data on failed uploads and rejects wrong-scope, wrong-type and excess files', async () => {
  const parts = [raw];
  await expect(persistChatFiles(parts, conversationId, async () => { throw new Error('Unavailable'); })).rejects.toThrow('Unavailable');
  await expect(persistChatFiles(parts, conversationId, async () => ({ ...stored, url: chatFileReference(other, attachmentId) }))).rejects.toThrow();
  await expect(persistChatFiles(parts, conversationId, async () => ({ ...stored, mediaType: 'application/pdf' }))).rejects.toThrow();
  await expect(persistChatFiles([{ ...raw, url: 'https://internal.example/file' }], conversationId, async () => null)).rejects.toThrow('Reattach');
  await expect(persistChatFiles(Array(5).fill(raw), conversationId, async () => { throw new Error('Must not upload'); })).rejects.toThrow('four');
  expect(parts[0]).toBe(raw);
});

test('HTTP upload retries reuse the same payload and only return validated references', async () => {
  const bodies: unknown[] = [];
  const repository = createHttpChatRepository(async (path, init) => {
    expect(path).toBe(`/api/conversations/${conversationId}/attachments`);
    bodies.push(JSON.parse(String(init?.body)));
    if (bodies.length === 1) throw new Error('Response lost');
    return Response.json({ file: stored });
  });
  await expect(repository.persistAttachments(conversationId, [raw])).rejects.toThrow('Response lost');
  expect(await repository.persistAttachments(conversationId, [raw])).toEqual([stored]);
  expect(bodies).toEqual([{ dataUrl: raw.url, filename: 'key.png' }, { dataUrl: raw.url, filename: 'key.png' }]);
});
