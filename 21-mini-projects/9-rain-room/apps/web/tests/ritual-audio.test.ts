import test from 'node:test'
import assert from 'node:assert/strict'
import { RitualAudio } from '../src/pages/focus/lib/ritualAudio.ts'
function fixture() {
  const nodes: any[] = [],
    timers = new Map<number, () => void>()
  let creations = 0,
    sequence = 0
  const param = () => ({
    calls: [] as number[],
    setValueAtTime(value: number) {
      this.calls.push(value)
    },
    linearRampToValueAtTime(value: number) {
      this.calls.push(value)
    },
    exponentialRampToValueAtTime(value: number) {
      this.calls.push(value)
    },
  })
  const node = (source = false) => {
    const n: any = {
      connected: 0,
      disconnected: false,
      starts: [] as number[],
      stops: [] as number[],
      onended: null,
      connect() {
        this.connected++
      },
      disconnect() {
        this.disconnected = true
      },
      gain: param(),
      frequency: param(),
      Q: param(),
    }
    if (source) {
      n.start = (time: number) => n.starts.push(time)
      n.stop = (time: number) => n.stops.push(time)
    }
    nodes.push(n)
    return n
  }
  const context: any = {
    state: 'suspended',
    currentTime: 7,
    sampleRate: 48000,
    destination: {},
    resumes: 0,
    closes: 0,
    async resume() {
      this.resumes++
      this.state = 'running'
    },
    async close() {
      this.closes++
      this.state = 'closed'
    },
    createGain: () => node(),
    createOscillator: () => node(true),
    createBufferSource: () => node(true),
    createBiquadFilter: () => node(),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
  }
  const audio = new RitualAudio({
    createContext: () => {
      creations++
      return context
    },
    setTimeout: (callback) => {
      timers.set(++sequence, callback)
      return sequence
    },
    clearTimeout: (token) => timers.delete(token as number),
  })
  return { audio, context, nodes, timers, creations: () => creations }
}
test('cues are silent before gesture, share one lazy context, and reject overlapping identical cues', async () => {
  const f = fixture()
  f.audio.print()
  f.audio.cup()
  assert.equal(f.creations(), 0)
  assert.equal(await f.audio.unlock(), true)
  assert.equal(f.creations(), 1)
  await f.audio.unlock()
  assert.equal(f.creations(), 1)
  f.audio.print()
  const count = f.nodes.length
  f.audio.print()
  assert.equal(f.nodes.length, count)
  const sources = f.nodes.filter((n) => n.starts.length)
  assert.equal(sources.length, 2)
  assert.ok(sources.every((n) => n.stops[0] - n.starts[0] <= 0.451))
  assert.ok(
    f.nodes.find((n) => n.gain.calls.length).gain.calls.every((value: number) => value <= 0.06),
  )
  for (const callback of [...f.timers.values()]) callback()
  assert.equal(f.timers.size, 0)
  assert.ok(f.nodes.every((n) => n.disconnected))
  f.audio.cup()
  assert.equal(f.creations(), 1)
  f.audio.dispose()
  assert.equal(f.context.closes, 1)
})
test('mute and dispose cancel scheduled cues and callbacks; disposed instances cannot restart', async () => {
  const f = fixture()
  f.audio.setMuted(true)
  assert.equal(await f.audio.unlock(), false)
  assert.equal(f.creations(), 0)
  f.audio.setMuted(false)
  await f.audio.unlock()
  f.audio.cup()
  assert.equal(f.timers.size, 1)
  const sources = f.nodes.filter((n) => n.starts.length)
  assert.ok(sources.every((n) => n.stops[0] - n.starts[0] <= 0.181))
  f.audio.setMuted(true)
  assert.equal(f.timers.size, 0)
  assert.ok(f.nodes.every((n) => n.disconnected))
  assert.ok(sources.every((n) => n.onended === null))
  f.audio.setMuted(false)
  f.audio.print()
  f.audio.dispose()
  f.audio.dispose()
  assert.equal(f.timers.size, 0)
  assert.equal(f.context.closes, 1)
  const count = f.nodes.length
  f.audio.print()
  f.audio.cup()
  assert.equal(await f.audio.unlock(), false)
  assert.equal(f.nodes.length, count)
})
test('browser absence and resume rejection are recoverable without unhandled audio errors', async () => {
  const absent = new RitualAudio({ createContext: () => null })
  assert.equal(await absent.unlock(), false)
  assert.doesNotThrow(() => {
    absent.print()
    absent.cup()
    absent.dispose()
  })
  const f = fixture()
  f.context.resume = async () => {
    throw Error('autoplay rejected')
  }
  assert.equal(await f.audio.unlock(), false)
  f.audio.print()
  assert.equal(f.nodes.length, 0)
  f.context.resume = async () => {
    f.context.state = 'running'
  }
  assert.equal(await f.audio.unlock(), true)
  assert.equal(f.creations(), 1)
  f.audio.dispose()
})

test('concurrent unlocks share one pending gesture and disposal prevents late resumed playback', async () => {
  const f = fixture()
  let resume!: () => void
  f.context.resume = () =>
    new Promise<void>((resolve) => {
      resume = () => {
        f.context.state = 'running'
        resolve()
      }
    })
  const first = f.audio.unlock(),
    second = f.audio.unlock()
  assert.equal(first, second)
  assert.equal(f.creations(), 1)
  f.audio.dispose()
  resume()
  assert.equal(await first, false)
  f.audio.print()
  f.audio.cup()
  assert.equal(f.nodes.length, 0)
  assert.equal(f.timers.size, 0)
  assert.equal(f.context.closes, 1)
})
test('partially failed audio graphs disconnect immediately and leave later cues available', async () => {
  const f = fixture()
  await f.audio.unlock()
  const oscillator = f.context.createOscillator
  f.context.createOscillator = () => {
    throw Error('audio device failure')
  }
  assert.doesNotThrow(() => f.audio.print())
  assert.ok(f.nodes.every((node) => node.disconnected))
  assert.equal(f.timers.size, 0)
  f.context.createOscillator = oscillator
  f.audio.cup()
  assert.equal(f.timers.size, 1)
  f.audio.dispose()
  assert.equal(f.timers.size, 0)
})

test('reduced print is one short graph and stage cleanup cancels delayed permission without canceling cup', async () => {
  const f = fixture()
  await f.audio.unlock()
  await f.audio.printWhenReady(true)
  const sources = f.nodes.filter((n) => n.starts.length)
  assert.equal(sources.length, 2)
  assert.ok(sources.every((n) => n.stops[0] - n.starts[0] <= 0.121))
  f.audio.cup()
  f.audio.cancelPrint()
  assert.equal(f.timers.size, 1, 'cup cue remains independent')
  f.audio.dispose()
  const delayed = fixture()
  let resolve!: () => void
  delayed.context.resume = () =>
    new Promise<void>((done) => {
      resolve = () => {
        delayed.context.state = 'running'
        done()
      }
    })
  const pending = delayed.audio.printWhenReady(true)
  delayed.audio.cancelPrint()
  resolve()
  await pending
  assert.equal(delayed.nodes.length, 0, 'stage ended before permission; no late print')
  delayed.audio.dispose()
})
test('muting invalidates pending print even if unmuted before permission resolves', async () => {
  const f = fixture()
  let resolve!: () => void
  f.context.resume = () =>
    new Promise<void>((done) => {
      resolve = () => {
        f.context.state = 'running'
        done()
      }
    })
  const pending = f.audio.printWhenReady()
  f.audio.setMuted(true)
  f.audio.setMuted(false)
  resolve()
  await pending
  assert.equal(f.nodes.length, 0)
  await f.audio.printWhenReady(true)
  assert.ok(f.nodes.some((n) => n.starts.length))
  f.audio.dispose()
})
