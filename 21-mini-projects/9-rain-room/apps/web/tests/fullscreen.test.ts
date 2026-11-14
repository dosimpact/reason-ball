import test from 'node:test'
import assert from 'node:assert/strict'
import { FullscreenIdle, FULLSCREEN_IDLE_MS } from '../src/pages/focus/lib/fullscreenIdle.ts'
function clock() {
  let now = 0
  let nextId = 0
  const jobs = new Map<number, { at: number; run: () => void }>()
  const schedule = ((run: () => void, delay: number) => {
    const id = ++nextId
    jobs.set(id, { at: now + delay, run })
    return id
  }) as unknown as typeof setTimeout
  const cancel = ((id: number) => jobs.delete(id)) as unknown as typeof clearTimeout
  const advance = (amount: number) => {
    now += amount
    for (const [id, job] of jobs)
      if (job.at <= now) {
        jobs.delete(id)
        job.run()
      }
  }
  return { schedule, cancel, advance, jobs }
}
test('fullscreen controls hide after 2.5 seconds from the last interaction', () => {
  const time = clock()
  const states: boolean[] = []
  const idle = new FullscreenIdle((value) => states.push(value), time.schedule, time.cancel)
  idle.reveal()
  time.advance(FULLSCREEN_IDLE_MS - 1)
  assert.equal(states.at(-1), true)
  idle.reveal()
  time.advance(1)
  assert.equal(states.at(-1), true)
  time.advance(FULLSCREEN_IDLE_MS - 1)
  assert.equal(states.at(-1), false)
  idle.destroy()
})
test('active slider and keyboard interactions hold controls; release starts a fresh countdown', () => {
  const time = clock()
  const states: boolean[] = []
  const idle = new FullscreenIdle((value) => states.push(value), time.schedule, time.cancel)
  idle.hold('pointer')
  idle.hold('keyboard')
  time.advance(10000)
  assert.equal(states.at(-1), true)
  idle.release('pointer')
  time.advance(10000)
  assert.equal(states.at(-1), true)
  idle.release('keyboard')
  time.advance(FULLSCREEN_IDLE_MS - 1)
  assert.equal(states.at(-1), true)
  time.advance(1)
  assert.equal(states.at(-1), false)
  idle.destroy()
})
test('closing clears stale timeouts and prevents later state changes', () => {
  const time = clock()
  const states: boolean[] = []
  const idle = new FullscreenIdle((value) => states.push(value), time.schedule, time.cancel)
  idle.reveal()
  idle.destroy()
  assert.equal(time.jobs.size, 0)
  time.advance(10000)
  idle.reveal()
  idle.release('pointer')
  assert.deepEqual(states, [true])
})

test('iOS Chrome and desktop-UA iPad prefer raster art, other platforms retain animated scenes', async () => {
  const { prefersRasterScene, fullscreenBackgroundUrl } = await import(
    '../src/pages/focus/lib/fullscreenPlatform.ts'
  )
  assert.equal(
    prefersRasterScene({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/142.0 Mobile Safari/604.1',
    }),
    true,
  )
  assert.equal(
    prefersRasterScene({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    }),
    true,
  )
  assert.equal(
    prefersRasterScene({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    }),
    false,
  )
  assert.equal(
    prefersRasterScene({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/142' }),
    false,
  )
  assert.equal(fullscreenBackgroundUrl('cafe-rain'), '/backgrounds/rear/fullscreen/cafe-rain.png')
})
