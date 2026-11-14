import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceMusicQueue,
  makeMusicQueue,
  shuffledIds,
} from '../src/pages/focus/model/musicQueue.ts'

test('shuffle snapshots unique matching IDs once per cycle and leaves input unchanged', () => {
  const ids = ['a', 'b', 'c', 'd']
  const queue = makeMusicQueue(ids, '집중 + 우주', () => 0.25)!
  assert.equal(queue.criteria, '집중 + 우주')
  assert.deepEqual([...queue.ids].sort(), ids)
  assert.deepEqual(ids, ['a', 'b', 'c', 'd'])
  let current = queue
  const played = [current.ids[current.index]]
  for (let i = 1; i < ids.length; i++) {
    current = advanceMusicQueue(current, () => 0.25)
    played.push(current.ids[current.index])
  }
  assert.equal(new Set(played).size, ids.length)
  const previous = current.ids[current.index]
  current = advanceMusicQueue(current, () => 0.25)
  assert.equal(current.index, 0)
  assert.notEqual(current.ids[0], previous)
  assert.deepEqual([...current.ids].sort(), ids)
})
test('single-song queues repeat; empty results cannot start; repeated IDs are deduplicated', () => {
  assert.equal(makeMusicQueue([], ''), null)
  const single = makeMusicQueue(['one'], '하나')!
  assert.deepEqual(advanceMusicQueue(single), single)
  assert.deepEqual(shuffledIds(['', 'one', 'one']), ['one'])
})
test('every cycle boundary avoids repeating the prior final song for multiple songs', () => {
  for (const previous of ['a', 'b', 'c']) {
    for (const random of [0, 0.3, 0.99999]) {
      const ids = shuffledIds(['a', 'b', 'c'], previous, () => random)
      assert.notEqual(ids[0], previous)
      assert.equal(new Set(ids).size, 3)
    }
  }
})

test('repeat mode repeats natural endings while manual next advances and sequential mode follows canonical order', async () => {
  const { advancePlayback, playbackQueue } = await import('../src/pages/focus/model/musicQueue.ts')
  const canonical = ['a', 'b', 'c']
  const queue = { ids: ['c', 'a', 'b'], index: 1, criteria: 'all' }
  assert.deepEqual(advancePlayback(queue, 'repeat-one', canonical), queue)
  const manual = advancePlayback(queue, 'repeat-one', canonical, true)
  assert.equal(manual.ids[manual.index], 'b')
  const sequential = advancePlayback(queue, 'sequential', canonical)
  assert.deepEqual(sequential.ids, canonical)
  assert.equal(sequential.index, 1)
  assert.equal(advancePlayback({ ...sequential, index: 2 }, 'sequential', canonical).index, 0)
  for (const mode of ['repeat-one', 'shuffle', 'sequential'] as const) {
    const one = playbackQueue(['a'], 'a', mode, 'one')
    assert.deepEqual(advancePlayback(one, mode, ['a'], true), one)
  }
})
test('entering shuffle anchors the current song before a complete unique first cycle', async () => {
  const { playbackQueue, advancePlayback, sanitizePlaybackMode } = await import(
    '../src/pages/focus/model/musicQueue.ts'
  )
  let queue = playbackQueue(['a', 'b', 'c', 'd'], 'c', 'shuffle', 'all', () => 0.2)
  assert.equal(queue.index, 0)
  assert.equal(queue.ids[0], 'c')
  const seen = []
  for (let i = 0; i < 4; i++) {
    seen.push(queue.ids[queue.index])
    queue = advancePlayback(queue, 'shuffle', ['a', 'b', 'c', 'd'], false, () => 0.2)
  }
  assert.equal(new Set(seen).size, 4)
  assert.notEqual(queue.ids[0], seen.at(-1))
  for (const invalid of [null, undefined, 'legacy', '__proto__'])
    assert.equal(sanitizePlaybackMode(invalid), 'repeat-one')
})

test('a preferred first song anchors the entire unique shuffle pool and never enters from outside it', () => {
  const ids = ['a', 'b', 'c', 'd', 'b']
  const queue = makeMusicQueue(ids, 'category', () => 0.25, 'c')!
  assert.equal(queue.ids[0], 'c')
  assert.equal(queue.index, 0)
  assert.deepEqual([...queue.ids].sort(), ['a', 'b', 'c', 'd'])
  let current = queue
  const played = []
  for (let i = 0; i < queue.ids.length; i++) {
    played.push(current.ids[current.index])
    current = advanceMusicQueue(current, () => 0.25)
  }
  assert.equal(new Set(played).size, 4)
  assert.notEqual(current.ids[0], played.at(-1))
  assert.deepEqual(
    makeMusicQueue(ids, 'category', () => 0.25, 'outside'),
    makeMusicQueue(ids, 'category', () => 0.25),
  )
  assert.deepEqual(ids, ['a', 'b', 'c', 'd', 'b'])
})
