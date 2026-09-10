import { expect, test } from "@playwright/test";
import { captureEditCheckpoint, editableParts, planEditedGeneration, prepareEditRequest } from "../../src/widgets/chat-workspace/model/remote-edit";
import { storedMessagesToChat, type MessageResponseItem } from "../../src/entities/chat/model/http-conversation";

const user: MessageResponseItem = { id: 'db-user', clientMessageId: 'ui-user', role: 'user', status: 'complete', parts: [{ type: 'text', text: 'Original' }], sequenceNumber: 1, createdAt: '2026-09-10' };
const answer: MessageResponseItem = { id: 'db-answer', role: 'assistant', status: 'complete', parts: [{ type: 'text', text: 'Answer' }], sequenceNumber: 2, createdAt: '2026-09-10' };
const rows = [user, answer];

test('captures server IDs without confusing the UI user key with the DB key', () => {
  const before = structuredClone(rows);
  expect(captureEditCheckpoint(rows, storedMessagesToChat(rows), 'ui-user')).toEqual({ sourceId: 'db-user', expectedTailId: 'db-answer' });
  expect(rows).toEqual(before);
});

test('rejects stale, pending, missing and changed edit snapshots', () => {
  const visible = storedMessagesToChat(rows);
  expect(() => captureEditCheckpoint([...rows, { ...user, id: 'later', clientMessageId: 'later' }], visible, 'ui-user')).toThrow('달라요');
  expect(() => captureEditCheckpoint([user, { ...answer, status: 'pending' }], visible, 'ui-user')).toThrow('달라요');
  expect(() => captureEditCheckpoint(rows, visible, 'missing')).toThrow('변경');
  expect(() => captureEditCheckpoint([{ ...user, parts: [{ type: 'text', text: 'Changed' }] }, answer], visible, 'ui-user')).toThrow('변경');
  expect(() => captureEditCheckpoint([], [], 'missing')).toThrow('변경');
});

test('normalizes display-only text state and retains only accepted user fields', () => {
  const input = [{ type: 'text' as const, text: 'Edited', state: 'done' as const }, { type: 'file' as const, url: 'https://example.test/file.png', mediaType: 'image/png', filename: 'file.png', size: 100 }];
  const before = structuredClone(input);
  expect(editableParts(input)).toEqual([{ type: 'text', text: 'Edited' }, { type: 'file', url: 'https://example.test/file.png', mediaType: 'image/png', filename: 'file.png' }]);
  expect(input).toEqual(before);
  expect(() => editableParts([])).toThrow('내용');
  expect(() => editableParts([{ type: 'text', text: '  ' }])).toThrow('내용');
  expect(() => editableParts([{ type: 'reasoning', text: 'Untrusted' }])).toThrow('사용자 메시지');
});

test('retries identical edits with the original key and uses a new key for changed input', () => {
  const first = prepareEditRequest(undefined, user.parts, 'first-key');
  expect(prepareEditRequest(first, user.parts, 'unused-key')).toBe(first);
  expect(prepareEditRequest(first, [{ type: 'text', text: 'Different' }], 'next-key').requestId).toBe('next-key');
});

test('continues the persisted edited turn and restores an already completed reply', () => {
  const edited = { ...user, id: 'edit-key', clientMessageId: 'edit-key' };
  const plan = planEditedGeneration([edited], 'edit-key');
  expect(plan.kind).toBe('send');
  if (plan.kind === 'send') { expect(plan.userMessage.id).toBe('edit-key'); expect(plan.history).toEqual([]); }
  expect(planEditedGeneration([edited, answer], 'edit-key').kind).toBe('restore');
  expect(() => planEditedGeneration(rows, 'edit-key')).toThrow('변경');
  expect(() => planEditedGeneration([edited, user], 'edit-key')).toThrow('다른 메시지');
});
