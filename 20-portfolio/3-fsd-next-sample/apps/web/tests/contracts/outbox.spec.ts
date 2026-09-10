import { expect, test } from '@playwright/test';
import { prepareOutbox, reconcileOutbox, draftAfterTransmission } from '../../src/entities/chat/model/outbox';
import { createOutboxStorage, outboxKey } from '../../src/entities/chat/api/outbox-storage';
import { createDraftStorage } from '../../src/entities/chat/api/draft-storage';
import type { ChatConversation, ChatMessage } from '../../src/entities/chat/model/types';

const conversation: ChatConversation = { id: 'chat', characterId: 'character', characterName: 'Emma',
  routeKey: 'character:free', createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z',
  title: 'Practice', modelId: 'model-a', messages: [], draft: 'Next draft', theme: 'light', votes: {}, artifacts: [] };
const user: ChatMessage = { id: 'stable-user-key', role: 'user', parts: [{ type: 'text', text: 'Hello' }] };
const entry = prepareOutbox(conversation, user, 'model-a', '2026-09-10T00:01:00Z');

test('removes the pre-submit draft after a crash without dropping a different next draft', () => {
  expect(draftAfterTransmission(' Hello ', entry)).toBe('');
  expect(draftAfterTransmission('A new question', entry)).toBe('A new question');
  expect(draftAfterTransmission('', entry)).toBe('');
});
function memoryStorage() {
  const rows = new Map<string, string>();
  return { get length() { return rows.size; }, key: (index: number) => [...rows.keys()][index] ?? null,
    getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); },
    removeItem: (key: string) => { rows.delete(key); } };
}

test('restores an unreceived turn with the same ID, parts, model and independent next draft', () => {
  const before = structuredClone(conversation);
  const result = reconcileOutbox(conversation, entry);
  expect(result.stored).toBe(false);
  expect(result.conversation.messages).toEqual([user]);
  expect(result.conversation.modelId).toBe('model-a');
  expect(result.conversation.pendingRequest?.userMessageId).toBe(user.id);
  expect(result.conversation.draft).toBe('Next draft');
  expect(conversation).toEqual(before);
});

test('acknowledges stored user content even if its answer or a later turn already exists', () => {
  const saved = { ...conversation, updatedAt: 'later', messages: [user, { id: 'answer', role: 'assistant' as const, parts: [{ type: 'text' as const, text: 'Welcome' }] }] };
  const result = reconcileOutbox(saved, entry);
  expect(result.stored).toBe(true);
  expect(result.conversation).toBe(saved);
  expect(result.conversation.messages).toHaveLength(2);
});

test('rejects changed metadata, tail, conversation and reused user IDs without appending', () => {
  for (const changed of [
    { ...conversation, updatedAt: 'new-revision' },
    { ...conversation, id: 'other' },
    { ...conversation, messages: [{ ...user, id: 'later-user' }] },
    { ...conversation, messages: [{ ...user, parts: [{ type: 'text' as const, text: 'Different' }] }] },
  ]) expect(() => reconcileOutbox(changed, entry)).toThrow();
});

test('normalizes display-only fields and rejects non-user or empty transmissions', () => {
  const prepared = prepareOutbox(conversation, { ...user, parts: [{ type: 'text', text: 'Hello', state: 'done' }] }, 'model-a', entry.startedAt);
  expect(prepared.parts).toEqual([{ type: 'text', text: 'Hello' }]);
  expect(() => prepareOutbox(conversation, { ...user, role: 'assistant' }, 'model-a', entry.startedAt)).toThrow();
  expect(() => prepareOutbox(conversation, { ...user, parts: [] }, 'model-a', entry.startedAt)).toThrow();
});

test('preserves one pending record and clears only the acknowledged user key', () => {
  const memory = memoryStorage();
  const store = createOutboxStorage(memory, 'alice', 'chat');
  expect(store.read()).toBeUndefined();
  store.write(entry); store.write(entry);
  expect(store.read()).toEqual(entry);
  expect(() => store.write({ ...entry, userMessageId: 'new-key' })).toThrow('이전 전송');
  store.clear('wrong-key'); expect(store.read()).toEqual(entry);
  store.clear(entry.userMessageId); expect(store.read()).toBeUndefined();
  expect(createOutboxStorage(memory, 'bob', 'chat').read()).toBeUndefined();
  expect(outboxKey('a:b', 'c')).not.toBe(outboxKey('a', 'b:c'));
});

test('retains corrupt records until explicit discard and propagates quota failures', () => {
  const memory = memoryStorage();
  memory.setItem(outboxKey('alice', 'chat'), '{');
  const store = createOutboxStorage(memory, 'alice', 'chat');
  expect(() => store.read()).toThrow();
  expect(() => store.write(entry)).toThrow();
  expect(memory.getItem(outboxKey('alice', 'chat'))).toBe('{');
  store.discard(); expect(store.read()).toBeUndefined();
  expect(() => createOutboxStorage({ ...memory, setItem() { throw new Error('Quota'); } }, 'alice', 'chat').write(entry)).toThrow('Quota');
});

test('owner and logout cleanup cover drafts and pending transmissions without touching other data', () => {
  const memory = memoryStorage();
  const drafts = createDraftStorage(memory);
  drafts.write('alice', 'chat', 'draft');
  createOutboxStorage(memory, 'alice', 'chat').write(entry);
  createOutboxStorage(memory, 'bob', 'chat').write(entry);
  memory.setItem('unrelated', 'keep');
  drafts.clearOwner('alice');
  expect(createOutboxStorage(memory, 'alice', 'chat').read()).toBeUndefined();
  expect(createOutboxStorage(memory, 'bob', 'chat').read()).toEqual(entry);
  drafts.clearAll();
  expect(createOutboxStorage(memory, 'bob', 'chat').read()).toBeUndefined();
  expect(memory.getItem('unrelated')).toBe('keep');
});
