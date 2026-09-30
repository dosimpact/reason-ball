import { expect, test } from '@playwright/test';
import { createDraftStorage, decodeDraft, draftKey } from '../../src/entities/chat/api/draft-storage';

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}

test('isolates drafts by user and conversation and preserves whitespace', () => {
  const store = createDraftStorage(memoryStorage());
  store.write('alice', 'one', '  Hello\n안녕하세요  ');
  store.write('alice', 'two', 'Another draft');
  store.write('bob', 'one', 'Private draft');
  expect(store.read('alice', 'one')).toBe('  Hello\n안녕하세요  ');
  expect(store.read('alice', 'two')).toBe('Another draft');
  expect(store.read('bob', 'one')).toBe('Private draft');
  expect(store.read('bob', 'two')).toBe('');
  expect(draftKey('a:b', 'c')).not.toBe(draftKey('a', 'b:c'));
});

test('clears one draft on empty input and clears only the requested owner', () => {
  const memory = memoryStorage();
  memory.setItem('unrelated', 'keep');
  const store = createDraftStorage(memory);
  store.write('alice', 'one', 'a'); store.write('alice', 'two', 'b'); store.write('bob', 'one', 'c');
  store.write('alice', 'one', '');
  expect(memory.getItem(draftKey('alice', 'one'))).toBeNull();
  store.clearOwner('alice');
  expect(store.read('alice', 'two')).toBe('');
  expect(store.read('bob', 'one')).toBe('c');
  expect(memory.getItem('unrelated')).toBe('keep');
  store.clearAll();
  expect([...memory.values]).toEqual([['unrelated', 'keep']]);
});

test('rejects corrupt drafts, missing identity and oversized input without replacing saved text', () => {
  expect(decodeDraft(null)).toBe('');
  for (const raw of ['{', 'null', '{}', '{"version":2,"text":"old"}', '{"version":1,"text":123}']) {
    expect(() => decodeDraft(raw)).toThrow();
  }
  expect(() => draftKey('', 'one')).toThrow();
  expect(() => draftKey('alice', '')).toThrow();
  const store = createDraftStorage(memoryStorage());
  store.write('alice', 'one', 'a'.repeat(32_000));
  expect(() => store.write('alice', 'one', 'a'.repeat(32_001))).toThrow('32,000');
  expect(store.read('alice', 'one')).toHaveLength(32_000);
  expect(() => store.clearOwner('')).toThrow();
});

test('propagates storage failures without claiming a successful write or read', () => {
  const memory = memoryStorage();
  const store = createDraftStorage({ ...memory, getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Quota'); }, removeItem() { throw new Error('Blocked'); } });
  expect(() => store.read('alice', 'one')).toThrow('Blocked');
  expect(() => store.write('alice', 'one', 'Keep in composer')).toThrow('Quota');
  expect(() => store.write('alice', 'one', '')).toThrow('Blocked');
});
