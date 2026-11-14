import test from 'node:test'
import assert from 'node:assert/strict'
import { AmbientAudio } from '../src/pages/focus/lib/ambientAudio.ts'
import { AMBIENT_SOUNDS, defaultAmbient, type AmbientId } from '../src/pages/focus/model/ambient.ts'

class FakeNode {
  disconnected = false
  gain = {
    value: 0,
    setTargetAtTime: (value: number) => {
      this.gain.value = value
    },
  }
  threshold = { value: 0 }
  knee = { value: 0 }
  ratio = { value: 0 }
  connect<T>(node: T): T {
    return node
  }
  disconnect() {
    this.disconnected = true
  }
}
class FakeSource extends FakeNode {
  buffer: unknown = null
  loop = false
  starts = 0
  stops = 0
  start() {
    this.starts++
  }
  stop() {
    this.stops++
  }
}
class FakeContext {
  static instances: FakeContext[] = []
  static failResume = false
  sources: FakeSource[] = []
  state = 'suspended'
  currentTime = 0
  destination = new FakeNode()
  onstatechange: (() => void) | null = null
  decodeCount = 0
  decode: (() => Promise<unknown>) | null = null
  constructor() {
    FakeContext.instances.push(this)
  }
  createDynamicsCompressor() {
    return new FakeNode()
  }
  createGain() {
    return new FakeNode()
  }
  createBufferSource() {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  async decodeAudioData() {
    this.decodeCount++
    return this.decode ? this.decode() : this.createBuffer(1, 128)
  }
  async resume() {
    if (FakeContext.failResume) throw new Error('Device blocked')
    this.state = 'running'
    this.onstatechange?.()
  }
  async suspend() {
    this.state = 'suspended'
    this.onstatechange?.()
  }
  async close() {
    this.state = 'closed'
    this.onstatechange?.()
  }
}
function mix(...ids: AmbientId[]) {
  const value = defaultAmbient()
  for (const item of AMBIENT_SOUNDS) value[item.id].enabled = ids.includes(item.id)
  return value
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
async function harness(
  run: (audio: AmbientAudio, status: boolean[], errors: string[]) => Promise<void>,
) {
  const previousContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const previousFetch = globalThis.fetch
  FakeContext.instances = []
  FakeContext.failResume = false
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: FakeContext,
  })
  globalThis.fetch = async () =>
    ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as Response
  const status: boolean[] = []
  const errors: string[] = []
  const audio = new AmbientAudio(
    (value) => status.push(value),
    (value) => errors.push(value),
  )
  try {
    await run(audio, status, errors)
  } finally {
    audio.close()
    globalThis.fetch = previousFetch
    if (previousContext) Object.defineProperty(globalThis, 'AudioContext', previousContext)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
  }
}

test('selected sources start together; disabling one stops and disconnects only that source', async () => {
  await harness(async (audio, status) => {
    await audio.start(mix('rain', 'crickets', 'birds'))
    const ctx = FakeContext.instances[0]
    assert.equal(ctx.sources.length, 3)
    assert.ok(ctx.sources.every((s) => s.starts === 1 && s.stops === 0))
    assert.equal(status.at(-1), true)
    await audio.sync(mix('crickets', 'birds'))
    assert.equal(ctx.sources[0].stops, 1)
    assert.equal(ctx.sources[0].disconnected, true)
    assert.ok(ctx.sources.slice(1).every((s) => s.stops === 0))
    assert.equal(status.at(-1), true)
    audio.stop()
    assert.ok(ctx.sources.every((s) => s.stops === 1 && s.disconnected))
    assert.equal(status.at(-1), false)
  })
})

test('stop and close invalidate pending café decode without resurrecting a source', async () => {
  for (const action of ['stop', 'close'] as const) {
    await harness(async (audio, status) => {
      const decoded = deferred<unknown>()
      const started = audio.start(mix('cafe'))
      // resume yields before the lazy fetch/decode begins.
      const ctx = FakeContext.instances[0]
      ctx.decode = () => decoded.promise
      await flush()
      assert.equal(ctx.decodeCount, 1)
      audio[action]()
      decoded.resolve(ctx.createBuffer(1, 128))
      await started
      assert.equal(ctx.sources.length, 0)
      assert.equal(status.at(-1), false)
    })
  }
})

test('blocked context or unavailable recording yields an error and never reports playback', async () => {
  await harness(async (audio, status, errors) => {
    FakeContext.failResume = true
    await audio.start(mix('rain'))
    assert.equal(status.at(-1), false)
    assert.ok(errors.some((message) => message.includes('재생하지 못했어요')))
    assert.equal(FakeContext.instances[0].sources.length, 0)
  })
  await harness(async (audio, status, errors) => {
    globalThis.fetch = async () => ({ ok: false }) as Response
    await audio.start(mix('cafe'))
    assert.equal(status.at(-1), false)
    assert.ok(errors.some((message) => message.includes('카페 사람들')))
    assert.equal(FakeContext.instances[0].sources.length, 0)
  })
})

test('volume updates and repeated starts reuse one decoded recording and one live voice', async () => {
  await harness(async (audio, status) => {
    let fetchCount = 0
    globalThis.fetch = async () => {
      fetchCount++
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response
    }
    const selected = mix('cafe')
    await audio.start(selected)
    const ctx = FakeContext.instances[0]
    selected.cafe.volume = 0.12
    await audio.sync(selected)
    selected.cafe.volume = 0.87
    await audio.sync(selected)
    await audio.start(selected)
    assert.equal(fetchCount, 1)
    assert.equal(ctx.decodeCount, 1)
    assert.equal(ctx.sources.length, 1)
    assert.equal(ctx.sources[0].stops, 0)
    assert.equal(status.at(-1), true)
    audio.stop()
    await audio.start(selected)
    assert.equal(ctx.decodeCount, 1)
    assert.equal(ctx.sources.length, 2)
    assert.equal(ctx.sources[0].stops, 1)
    assert.equal(ctx.sources[1].starts, 1)
  })
})

test('volume edits during pending decode create one voice; deselection prevents a late start', async () => {
  for (const deselect of [false, true]) {
    await harness(async (audio) => {
      const decoded = deferred<unknown>()
      const selected = mix('cafe')
      const started = audio.start(selected)
      const ctx = FakeContext.instances[0]
      ctx.decode = () => decoded.promise
      await flush()
      const updated = mix('cafe')
      updated.cafe.volume = 0.2
      const firstEdit = audio.sync(updated)
      updated.cafe.volume = 0.8
      const secondEdit = audio.sync(updated)
      if (deselect) await audio.sync(mix())
      decoded.resolve(ctx.createBuffer(1, 128))
      await Promise.all([started, firstEdit, secondEdit])
      assert.equal(ctx.decodeCount, 1)
      assert.equal(ctx.sources.length, deselect ? 0 : 1)
      if (!deselect) assert.equal(ctx.sources[0].starts, 1)
    })
  }
})

test('unexpected oversized replacement recordings fail without decoding or starting a voice', async () => {
  await harness(async (audio, status, errors) => {
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: () => '3000000' },
        arrayBuffer: async () => new ArrayBuffer(8),
      }) as unknown as Response
    await audio.start(mix('rain'))
    const ctx = FakeContext.instances[0]
    assert.equal(ctx.decodeCount, 0)
    assert.equal(ctx.sources.length, 0)
    assert.equal(status.at(-1), false)
    assert.ok(errors.some((message) => message.includes('빗소리')))
  })
})
