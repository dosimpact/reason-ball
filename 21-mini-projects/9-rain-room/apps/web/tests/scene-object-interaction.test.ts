import test from 'node:test'
import assert from 'node:assert/strict'
import { SceneObjectInteractionController } from '../src/pages/focus/model/sceneObjectInteraction.ts'
import type { SceneInteractiveObject } from '../src/pages/focus/model/sceneInteractiveTypes.ts'

const object = (id: string): SceneInteractiveObject => ({
  id,
  roomId: 'test-room',
  label: { ko: '종', en: 'Bell', zh: '铃' },
  position: { x: 300, y: 640 },
  scale: 0.8,
  surface: { kind: 'table', note: 'Fixture test tabletop' },
  art: { base: '', subject: '<circle cx="48" cy="48" r="20" fill="#a89a6e"/>' },
  reaction: { type: 'wobble', durationMs: 1200, color: '#baa67a', description: '짧게 흔들림' },
})

test('passing time never initiates a discovery or carries state to another room', () => {
  const room = new SceneObjectInteractionController([object('bell')])
  room.advance(100000)
  assert.equal(room.activeCount, 0)
  assert.equal(room.frame('bell'), undefined)
  assert.equal(room.activate('another-room:bell'), false)
  assert.equal(room.activate('bell'), true)
  const nextRoom = new SceneObjectInteractionController([object('bell')])
  assert.equal(nextRoom.activeCount, 0)
  room.dispose()
  nextRoom.dispose()
})

test('only the pressed object reacts, returns to rest, and can be discovered again', () => {
  const room = new SceneObjectInteractionController([object('bell'), object('grinder')])
  assert.equal(room.activate('bell'), true)
  assert.equal(room.frame('grinder'), undefined)
  room.advance(600)
  assert.equal(room.frame('bell')?.progress, 0.5)
  assert.equal(room.frame('bell')?.intensity, 1)
  room.advance(600)
  assert.equal(room.activeCount, 0)
  assert.equal(room.frame('bell'), undefined)
  assert.equal(room.activate('bell'), true)
  assert.equal(room.frame('bell')?.trigger, 2)
  room.dispose()
})

test('rapid repeated input is bounded while separate objects stay independent', () => {
  const room = new SceneObjectInteractionController([object('bell'), object('grinder')])
  assert.equal(room.activate('bell'), true)
  for (let n = 0; n < 100; n++) assert.equal(room.activate('bell'), false)
  assert.equal(room.activate('grinder'), true)
  assert.equal(room.activeCount, 2)
  room.advance(200)
  assert.equal(room.activate('bell'), true)
  assert.equal(room.frame('bell')?.elapsedMs, 0)
  assert.equal(room.frame('grinder')?.elapsedMs, 200)
  room.dispose()
})

test('reduced motion has brief finite feedback and invalid clock deltas cannot corrupt state', () => {
  const room = new SceneObjectInteractionController([object('bell')])
  room.activate('bell', { reducedMotion: true })
  assert.equal(room.frame('bell')?.reducedMotion, true)
  assert.equal(room.frame('bell')?.durationMs, 220)
  for (const delta of [NaN, Infinity, -10, 0]) room.advance(delta)
  assert.equal(room.frame('bell')?.elapsedMs, 0)
  room.advance(219)
  assert.equal(room.activeCount, 1)
  room.advance(1)
  assert.equal(room.activeCount, 0)
  room.dispose()
})

test('clear and disposal cancel active input without leaving callbacks or revivable state', () => {
  const room = new SceneObjectInteractionController([object('bell')])
  room.activate('bell')
  room.clear()
  assert.equal(room.frame('bell'), undefined)
  assert.equal(room.activate('bell'), true)
  room.dispose()
  room.dispose()
  room.advance(600)
  assert.equal(room.activeCount, 0)
  assert.equal(room.activate('bell'), false)
  assert.equal(room.frame('bell'), undefined)
})

test('duplicate identities and invalid authored durations fail before mounting graphics', () => {
  assert.throws(() => new SceneObjectInteractionController([object('bell'), object('bell')]))
  for (const durationMs of [0, -1, NaN, Infinity]) {
    const bad = object('bad')
    bad.reaction.durationMs = durationMs
    assert.throws(() => new SceneObjectInteractionController([bad]))
  }
})
