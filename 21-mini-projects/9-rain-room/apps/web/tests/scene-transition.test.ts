import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SceneTransitionController,
  SCENE_FADE_OUT_MS,
  SCENE_FADE_IN_MS,
  SCENE_LOAD_TIMEOUT_MS,
  type SceneTransitionScheduler,
  type SceneTransitionState,
  type SceneStatus,
} from '../src/pages/focus/lib/sceneTransition.ts'
class Clock implements SceneTransitionScheduler {
  now = 0
  private id = 0
  tasks = new Map<number, { at: number; callback: () => void }>()
  delay(callback: () => void, milliseconds: number) {
    const id = ++this.id
    this.tasks.set(id, { at: this.now + milliseconds, callback })
    return id
  }
  cancelDelay(token: unknown) {
    this.tasks.delete(token as number)
  }
  frame(callback: () => void) {
    return this.delay(callback, 16)
  }
  cancelFrame(token: unknown) {
    this.cancelDelay(token)
  }
  tick(milliseconds: number) {
    const until = this.now + milliseconds
    for (;;) {
      const next = [...this.tasks]
        .filter(([, task]) => task.at <= until)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
      if (!next) break
      this.now = next[1].at
      this.tasks.delete(next[0])
      next[1].callback()
    }
    this.now = until
  }
}
function setup(reducedMotion = false) {
  const clock = new Clock(),
    changes: { time: number; state: SceneTransitionState }[] = [],
    statuses: SceneStatus[] = []
  const controller = new SceneTransitionController({
    initialId: 'A',
    reducedMotion,
    scheduler: clock,
    onChange: (state) => changes.push({ time: clock.now, state }),
    onStatus: (status) => statuses.push(status),
  })
  return { clock, changes, statuses, controller }
}
test('normal fade paints opaque black before swapping and waits for ready to paint before reveal', () => {
  const { controller: c, clock, changes, statuses } = setup()
  c.status('A', 0, 'ready')
  assert.deepEqual(statuses, ['ready'])
  assert.equal(c.snapshot().phase, 'idle')
  c.request('B')
  assert.deepEqual(c.snapshot(), {
    displayedId: 'A',
    generation: 0,
    phase: 'fading-out',
    timedOut: false,
  })
  clock.tick(SCENE_FADE_OUT_MS - 1)
  assert.equal(c.snapshot().displayedId, 'A')
  clock.tick(1 + 16)
  assert.equal(c.snapshot().displayedId, 'A', 'first black frame must still contain old scene')
  clock.tick(16)
  assert.deepEqual(c.snapshot(), {
    displayedId: 'B',
    generation: 1,
    phase: 'loading',
    timedOut: false,
  })
  assert.equal(
    changes.find((change) => change.state.displayedId === 'B')!.time,
    SCENE_FADE_OUT_MS + 32,
  )
  clock.tick(500)
  assert.equal(c.snapshot().phase, 'loading')
  c.status('B', 1, 'ready')
  clock.tick(31)
  assert.equal(c.snapshot().phase, 'loading')
  clock.tick(1)
  assert.equal(c.snapshot().phase, 'fading-in')
  clock.tick(SCENE_FADE_IN_MS - 1)
  assert.equal(c.snapshot().phase, 'fading-in')
  clock.tick(1)
  assert.equal(c.snapshot().phase, 'idle')
  c.destroy()
  assert.equal(clock.tasks.size, 0)
})
test('rapid external targets use the latest scene and obsolete ready/error callbacks cannot reveal it', () => {
  const { controller: c, clock, statuses } = setup()
  c.request('B')
  clock.tick(100)
  c.request('C')
  clock.tick(SCENE_FADE_OUT_MS + 32 - 100)
  assert.equal(c.snapshot().displayedId, 'C')
  assert.equal(c.snapshot().generation, 1)
  c.status('A', 0, 'ready')
  assert.deepEqual(statuses, [])
  c.request('D')
  c.status('C', 1, 'ready')
  clock.tick(16)
  assert.equal(c.snapshot().displayedId, 'D')
  assert.equal(c.snapshot().phase, 'loading')
  c.status('C', 1, 'error')
  clock.tick(100)
  assert.equal(c.snapshot().phase, 'loading')
  assert.deepEqual(statuses, [])
  c.status('D', 2, 'ready')
  clock.tick(32 + SCENE_FADE_IN_MS)
  assert.equal(c.snapshot().phase, 'idle')
  c.destroy()
})
test('error and 15 second timeout both reveal the existing error or thumbnail fallback', () => {
  for (const terminal of ['error', 'timeout']) {
    const { controller: c, clock, statuses } = setup()
    c.request('B')
    clock.tick(SCENE_FADE_OUT_MS + 32)
    if (terminal === 'error') c.status('B', 1, 'error')
    else clock.tick(SCENE_LOAD_TIMEOUT_MS)
    assert.deepEqual(statuses, ['error'])
    clock.tick(32 + SCENE_FADE_IN_MS)
    assert.equal(c.snapshot().phase, 'idle')
    c.destroy()
    assert.equal(clock.tasks.size, 0)
  }
})
test('reduced motion omits animated delays while preserving black and ready frame barriers', () => {
  const { controller: c, clock } = setup(true)
  c.request('B')
  clock.tick(16)
  assert.equal(c.snapshot().displayedId, 'A')
  clock.tick(16)
  assert.equal(c.snapshot().displayedId, 'B')
  assert.equal(c.snapshot().phase, 'loading')
  c.status('B', 1, 'ready')
  clock.tick(31)
  assert.equal(c.snapshot().phase, 'loading')
  clock.tick(1)
  assert.equal(c.snapshot().phase, 'fading-in')
  clock.tick(16)
  assert.equal(c.snapshot().phase, 'idle')
  c.destroy()
})
test('new selection during reveal fades back to black before replacing that scene', () => {
  const { controller: c, clock } = setup()
  c.request('B')
  clock.tick(SCENE_FADE_OUT_MS + 32)
  c.status('B', 1, 'ready')
  clock.tick(32 + 100)
  assert.equal(c.snapshot().phase, 'fading-in')
  c.request('C')
  assert.equal(c.snapshot().phase, 'fading-out')
  clock.tick(SCENE_FADE_OUT_MS + 31)
  assert.equal(c.snapshot().displayedId, 'B')
  clock.tick(1)
  assert.equal(c.snapshot().displayedId, 'C')
  c.destroy()
})
test('unmount cancels every timer/frame and ignores late statuses; changing reduced preference is safe', () => {
  const { controller: c, clock, changes } = setup()
  c.request('B')
  clock.tick(50)
  c.setReducedMotion(true)
  clock.tick(32)
  assert.equal(c.snapshot().displayedId, 'B')
  c.status('B', 1, 'ready')
  clock.tick(16)
  c.destroy()
  const count = changes.length
  clock.tick(30000)
  c.status('B', 1, 'error')
  c.request('C')
  assert.equal(changes.length, count)
  assert.equal(clock.tasks.size, 0)
})

test('a new loading status before the ready paint barrier cancels that reveal', () => {
  const { controller: c, clock } = setup()
  c.request('B')
  clock.tick(SCENE_FADE_OUT_MS + 32)
  c.status('B', 1, 'ready')
  clock.tick(16)
  c.status('B', 1, 'loading')
  clock.tick(500)
  assert.equal(c.snapshot().phase, 'loading')
  c.status('B', 1, 'ready')
  clock.tick(32 + SCENE_FADE_IN_MS)
  assert.equal(c.snapshot().phase, 'idle')
  c.destroy()
})

test('timeout is explicit and same-id retry replaces one generation only after black is painted', () => {
  const { controller: c, clock } = setup()
  c.request('B')
  clock.tick(SCENE_FADE_OUT_MS + 32 + SCENE_LOAD_TIMEOUT_MS + 32 + SCENE_FADE_IN_MS)
  assert.equal(c.snapshot().timedOut, true)
  assert.equal(c.snapshot().phase, 'idle')
  c.retry()
  c.retry()
  assert.equal(c.snapshot().timedOut, false)
  assert.equal(c.snapshot().generation, 1)
  clock.tick(SCENE_FADE_OUT_MS + 31)
  assert.equal(c.snapshot().generation, 1)
  clock.tick(1)
  assert.equal(c.snapshot().generation, 2)
  assert.equal(c.snapshot().displayedId, 'B')
  c.status('B', 1, 'ready')
  clock.tick(100)
  assert.equal(c.snapshot().phase, 'loading')
  c.status('B', 2, 'ready')
  clock.tick(32 + SCENE_FADE_IN_MS)
  assert.equal(c.snapshot().phase, 'idle')
  assert.equal(c.snapshot().timedOut, false)
  c.destroy()
})
test('new target clears timeout and late genuine ready clears the current timeout notice', () => {
  const { controller: c, clock } = setup()
  c.request('B')
  clock.tick(SCENE_FADE_OUT_MS + 32 + SCENE_LOAD_TIMEOUT_MS)
  assert.equal(c.snapshot().timedOut, true)
  c.status('B', 1, 'ready')
  assert.equal(c.snapshot().timedOut, false)
  clock.tick(32 + SCENE_FADE_IN_MS)
  c.request('C')
  clock.tick(SCENE_FADE_OUT_MS + 32 + SCENE_LOAD_TIMEOUT_MS + 32 + SCENE_FADE_IN_MS)
  assert.equal(c.snapshot().timedOut, true)
  c.request('D')
  assert.equal(c.snapshot().timedOut, false)
  c.destroy()
})
