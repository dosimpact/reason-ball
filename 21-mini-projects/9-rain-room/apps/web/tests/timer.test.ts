import test from 'node:test'
import assert from 'node:assert/strict'
import {
  defaults,
  fresh,
  reconfigureSession,
  pause,
  restore,
  sanitizeSettings,
  tick,
} from '../src/pages/focus/model/timer.ts'
test('deadline accounts for time away and completes only the current phase', () => {
  const current = {
    ...fresh('focus', defaults),
    status: 'running' as const,
    deadline: 1000 + 35 * 60000,
  }
  assert.equal(tick(current, 61000).remaining, 34 * 60000)
  const elapsed = tick(current, 1000 + 8 * 3600000)
  assert.equal(elapsed.status, 'complete')
  assert.equal(elapsed.phase, 'focus')
  assert.equal(elapsed.remaining, 0)
})
test('pause freezes deadline-adjusted time and does not erase completion', () => {
  const current = { ...fresh('rest', defaults), status: 'running' as const, deadline: 300000 }
  const paused = pause(current, 10000)
  assert.equal(paused.remaining, 290000)
  assert.equal(paused.deadline, null)
  assert.deepEqual(tick(paused, 900000), paused)
  assert.equal(pause(current, 300001).status, 'complete')
})
test('restoration resumes a running deadline, retains paused time, and rejects corrupt state', () => {
  const running = { ...fresh('focus', defaults), status: 'running' as const, deadline: 2100000 }
  assert.equal(restore(running, defaults, 60000).remaining, 2040000)
  assert.equal(restore(running, defaults, 2100001).status, 'complete')
  const paused = pause(running, 100000)
  assert.deepEqual(restore(paused, defaults, 9000000), paused)
  for (const invalid of [
    null,
    {},
    { ...running, deadline: 'later' },
    { ...running, remaining: -1 },
    { ...running, duration: Infinity },
  ])
    assert.deepEqual(restore(invalid, defaults, 0), fresh('focus', defaults))
})
test('settings sanitize invalid input and future settings do not mutate current duration', () => {
  assert.deepEqual(sanitizeSettings({ focus: 999, rest: -5, music: NaN, rain: 5, track: 7 }), {
    ...defaults,
    focus: 180,
    rest: 1,
    ambient: { ...defaults.ambient, rain: { enabled: true, volume: 1 } },
  })
  const current = fresh('focus', defaults)
  const changed = sanitizeSettings({ ...defaults, focus: 15 })
  assert.equal(current.duration, 35 * 60000)
  assert.equal(fresh('focus', changed).duration, 15 * 60000)
})

test('saving changed durations resets the current phase and preserves running or paused intent', () => {
  const now = 100000
  const next = { ...defaults, focus: 15, rest: 10 }
  for (const phase of ['focus', 'rest'] as const) {
    const previous = {
      ...fresh(phase, defaults),
      remaining: 45000,
      status: 'running' as const,
      deadline: now + 45000,
    }
    const changed = reconfigureSession(previous, defaults, next, now)
    assert.equal(changed.phase, phase)
    assert.equal(changed.duration, next[phase] * 60000)
    assert.equal(changed.remaining, changed.duration)
    assert.equal(changed.deadline, now + changed.duration)
    assert.equal(changed.status, 'running')
    const paused = reconfigureSession(
      { ...previous, status: 'paused', deadline: null },
      defaults,
      next,
      now,
    )
    assert.equal(paused.status, 'paused')
    assert.equal(paused.remaining, next[phase] * 60000)
    assert.equal(paused.deadline, null)
    for (const status of ['idle', 'complete'] as const) {
      const reset = reconfigureSession({ ...previous, status, deadline: null }, defaults, next, now)
      assert.equal(reset.status, 'idle')
      assert.equal(reset.remaining, next[phase] * 60000)
    }
  }
})
test('changing the other phase also resets the current phase; unchanged durations preserve the exact session', () => {
  const runningRest = {
    ...fresh('rest', defaults),
    status: 'running' as const,
    remaining: 12000,
    deadline: 40000,
  }
  const changed = reconfigureSession(runningRest, defaults, { ...defaults, focus: 50 }, 100000)
  assert.equal(changed.remaining, 5 * 60000)
  assert.equal(changed.deadline, 100000 + 5 * 60000)
  assert.equal(changed.status, 'running')
  const unchanged = reconfigureSession(runningRest, defaults, { ...defaults, music: 0.2 }, 900000)
  assert.equal(unchanged, runningRest)
})
