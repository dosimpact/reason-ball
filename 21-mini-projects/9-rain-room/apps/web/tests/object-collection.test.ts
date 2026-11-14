import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseObjectCollection,
  mergeObjectCollections,
} from '../src/pages/focus/model/objectCollection.ts'
import {
  LocalObjectCollectionStorage,
  OBJECT_COLLECTION_STORAGE_KEY,
} from '../src/pages/focus/model/objectCollectionStorage.ts'
function memory(initial: string | null = null) {
  let raw = initial
  let writes = 0
  return {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value
      writes++
    },
    get writes() {
      return writes
    },
  }
}
test('reload and separate instances preserve first discovery timestamps and merge other entries', () => {
  const data = memory()
  const a = new LocalObjectCollectionStorage(() => data)
  const b = new LocalObjectCollectionStorage(() => data)
  a.update((latest) =>
    mergeObjectCollections(latest, { version: 1, collected: { 'old-object': 100 } }),
  )
  b.update((latest) =>
    mergeObjectCollections(latest, { version: 1, collected: { 'new-object': 200 } }),
  )
  a.update((latest) =>
    mergeObjectCollections(latest, { version: 1, collected: { 'old-object': 300 } }),
  )
  assert.deepEqual(new LocalObjectCollectionStorage(() => data).read(), {
    ok: true,
    ledger: { version: 1, collected: { 'old-object': 100, 'new-object': 200 } },
  })
  assert.equal(data.writes, 2)
  assert.equal(OBJECT_COLLECTION_STORAGE_KEY, 'rain-room.object-collection.v1')
})
test('malformed, newer, oversized or invalid ledgers are preserved without a write', () => {
  for (const raw of [
    '{',
    JSON.stringify({ version: 2, collected: { valid: 2 } }),
    JSON.stringify({ version: 1, collected: { object: -1 } }),
    JSON.stringify({ version: 1, collected: [] }),
    'x'.repeat(1500001),
  ]) {
    const data = memory(raw),
      adapter = new LocalObjectCollectionStorage(() => data)
    assert.equal(adapter.read().ok, false)
    assert.equal(adapter.update(() => ({ version: 1, collected: { another: 1 } })).ok, false)
    assert.equal(data.getItem(), raw)
    assert.equal(data.writes, 0)
  }
  assert.equal(
    parseObjectCollection({
      version: 1,
      collected: Object.fromEntries(Array.from({ length: 10001 }, (_, i) => [`object-${i}`, i])),
    }),
    null,
  )
  assert.equal(parseObjectCollection(JSON.parse('{"version":1,"collected":{"__proto__":4}}')), null)
})
test('unavailable storage and quota failures are reported truthfully', () => {
  assert.equal(
    new LocalObjectCollectionStorage(() => {
      throw Error('disabled')
    }).read().ok,
    false,
  )
  const adapter = new LocalObjectCollectionStorage(() => ({
    getItem: () => null,
    setItem: () => {
      throw Error('quota')
    },
  }))
  assert.equal(adapter.update(() => ({ version: 1, collected: { object: 42 } })).ok, false)
})
