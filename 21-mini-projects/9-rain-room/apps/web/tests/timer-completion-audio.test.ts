import test from 'node:test'
import assert from 'node:assert/strict'
import { TimerCompletionAudio } from '../src/pages/focus/lib/timerCompletionAudio.ts'
function audioFixture() {
  const context = {
    state: 'suspended',
    currentTime: 10,
    destination: {},
    resumes: 0,
    closes: 0,
    oscillators: [] as any[],
    gains: [] as any[],
    resume() {
      this.resumes++
      this.state = 'running'
      return Promise.resolve()
    },
    close() {
      this.closes++
      this.state = 'closed'
      return Promise.resolve()
    },
    createGain() {
      const node = {
        events: [] as [string, number, number][],
        disconnects: 0,
        connect() {},
        disconnect() {
          this.disconnects++
        },
        gain: {
          setValueAtTime(value: number, at: number) {
            node.events.push(['set', value, at])
          },
          linearRampToValueAtTime(value: number, at: number) {
            node.events.push(['ramp', value, at])
          },
        },
      }
      this.gains.push(node)
      return node
    },
    createOscillator() {
      const node = {
        type: '',
        frequency: {
          setValueAtTime(value: number, at: number) {
            node.frequencyValue = value
            node.frequencyAt = at
          },
        },
        frequencyValue: 0,
        frequencyAt: 0,
        starts: [] as number[],
        stops: [] as (number | undefined)[],
        disconnects: 0,
        onended: null as null | (() => void),
        connect() {},
        disconnect() {
          this.disconnects++
        },
        start(at: number) {
          this.starts.push(at)
        },
        stop(at?: number) {
          this.stops.push(at)
        },
      }
      this.oscillators.push(node)
      return node
    },
  }
  return context
}
test('completion cue lazily unlocks one context and schedules four gentle independent envelopes', () => {
  const context = audioFixture()
  let created = 0
  const cue = new TimerCompletionAudio(() => {
    created++
    return context as unknown as AudioContext
  })
  cue.play()
  assert.equal(created, 0)
  cue.prepare()
  cue.prepare()
  assert.equal(created, 1)
  assert.equal(context.resumes, 2)
  cue.play()
  assert.equal(context.oscillators.length, 4)
  assert.equal(context.gains.length, 4)
  context.oscillators.forEach((oscillator, index) => {
    assert.equal(oscillator.type, 'sine')
    assert.equal(oscillator.frequencyValue, 880)
    assert.ok(Math.abs(oscillator.starts[0] - (10.015 + index * 0.14)) < 1e-8)
    assert.ok(oscillator.stops[0] > oscillator.starts[0])
    assert.ok(oscillator.stops[0] - oscillator.starts[0] < 0.16)
    const events = context.gains[index].events
    assert.equal(events[0][1], 0)
    assert.equal(events.at(-1)![1], 0)
    assert.equal(Math.max(...events.map((event) => event[1])), 0.08)
  })
  cue.dispose()
  assert.equal(context.closes, 1)
  for (const oscillator of context.oscillators) {
    assert.equal(oscillator.stops.length, 2)
    assert.equal(oscillator.disconnects, 1)
    assert.equal(oscillator.onended, null)
  }
  for (const gain of context.gains) assert.equal(gain.disconnects, 1)
  cue.prepare()
  cue.play()
  assert.equal(context.oscillators.length, 4)
})
test('unavailable or rejected audio cannot throw or create sounds, and disposal invalidates a pending resume', async () => {
  const unavailable = new TimerCompletionAudio(() => null)
  unavailable.prepare()
  unavailable.play()
  unavailable.dispose()
  const blocked = audioFixture()
  blocked.resume = function () {
    this.resumes++
    return Promise.reject(new Error('blocked'))
  }
  const rejected = new TimerCompletionAudio(() => blocked as unknown as AudioContext)
  rejected.prepare()
  rejected.play()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(blocked.oscillators.length, 0)
  rejected.dispose()
  const pending = audioFixture()
  let resolve!: () => void
  const ready = new Promise<void>((done) => (resolve = done))
  pending.resume = () => ready
  const cue = new TimerCompletionAudio(() => pending as unknown as AudioContext)
  cue.prepare()
  cue.play()
  cue.dispose()
  pending.state = 'running'
  resolve()
  await new Promise((done) => setImmediate(done))
  assert.equal(pending.oscillators.length, 0)
  assert.equal(pending.closes, 1)
})
