import { AMBIENT_SOUNDS, type AmbientId, type AmbientMix } from '../model/ambient.ts'

type Voice = { source: AudioBufferSourceNode; gain: GainNode }
/** One lazy audio graph, independent of the music transport. */
export class AmbientAudio {
  private context: AudioContext | null = null
  private output: DynamicsCompressorNode | null = null
  private voices = new Map<AmbientId, Voice>()
  private loading = new Map<AmbientId, Promise<AudioBuffer>>()
  private buffers = new Map<AmbientId, AudioBuffer>()
  private requests = new Map<AmbientId, number>()
  private active = false
  private epoch = 0
  private mix: AmbientMix | null = null
  private onPlaying: (value: boolean) => void
  private onError: (message: string) => void
  constructor(onPlaying: (value: boolean) => void, onError: (message: string) => void) {
    this.onPlaying = onPlaying
    this.onError = onError
  }

  async start(mix: AmbientMix) {
    this.mix = mix
    if (!AMBIENT_SOUNDS.some((s) => mix[s.id].enabled)) {
      this.onError('먼저 재생할 환경음을 하나 이상 선택해 주세요.')
      return
    }
    const epoch = ++this.epoch
    this.active = true
    this.onError('')
    try {
      if (!this.context) {
        const ctx = new AudioContext()
        const compressor = ctx.createDynamicsCompressor()
        compressor.threshold.value = -18
        compressor.knee.value = 24
        compressor.ratio.value = 8
        const master = ctx.createGain()
        master.gain.value = 0.7
        compressor.connect(master).connect(ctx.destination)
        this.context = ctx
        this.output = compressor
        ctx.onstatechange = () => {
          if (ctx !== this.context) return
          this.onPlaying(this.active && ctx.state === 'running' && this.voices.size > 0)
        }
      }
      await this.context.resume()
      if (!this.active || this.epoch !== epoch) {
        if (!this.active) void this.context.suspend().catch(() => {})
        return
      }
      if (this.context.state !== 'running') throw new Error('Audio context suspended')
      await this.sync(mix)
      if (this.active && this.epoch === epoch) this.onPlaying(this.voices.size > 0)
    } catch {
      if (this.epoch !== epoch) return
      this.stop()
      this.onError(
        '환경음을 재생하지 못했어요. 재생 버튼을 다시 눌러 주세요. 이 브라우저가 Web Audio를 지원하는지도 확인해 주세요.',
      )
    }
  }

  async sync(mix: AmbientMix) {
    this.mix = mix
    for (const sound of AMBIENT_SOUNDS) {
      const voice = this.voices.get(sound.id)
      if (!mix[sound.id].enabled) {
        this.requests.set(sound.id, (this.requests.get(sound.id) ?? 0) + 1)
        if (voice) this.remove(sound.id)
      } else if (voice && this.context) {
        voice.gain.gain.setTargetAtTime(mix[sound.id].volume * 0.3, this.context.currentTime, 0.06)
      }
    }
    if (!this.active || !this.context) return
    this.onPlaying(this.context.state === 'running' && this.voices.size > 0)
    if (!AMBIENT_SOUNDS.some((s) => mix[s.id].enabled)) {
      this.stop()
      return
    }
    const epoch = this.epoch
    await Promise.all(
      AMBIENT_SOUNDS.filter((s) => mix[s.id].enabled && !this.voices.has(s.id)).map(
        async (sound) => {
          const request = (this.requests.get(sound.id) ?? 0) + 1
          this.requests.set(sound.id, request)
          try {
            const buffer = await this.buffer(sound.id)
            const ctx = this.context
            if (
              !ctx ||
              !this.active ||
              this.epoch !== epoch ||
              this.requests.get(sound.id) !== request ||
              !this.mix?.[sound.id].enabled ||
              this.voices.has(sound.id)
            )
              return
            const source = ctx.createBufferSource()
            source.buffer = buffer
            source.loop = true
            const gain = ctx.createGain()
            gain.gain.value = this.mix[sound.id].volume * 0.3
            source.connect(gain).connect(this.output!)
            source.start()
            this.voices.set(sound.id, { source, gain })
            this.onPlaying(ctx.state === 'running')
          } catch {
            if (this.active && this.epoch === epoch && this.requests.get(sound.id) === request) {
              this.onError(
                `${sound.name}을 불러오지 못했어요. 연결을 확인한 뒤 이 소리를 껐다 켜 주세요.`,
              )
            }
          }
        },
      ),
    )
  }

  stop() {
    this.active = false
    ++this.epoch
    for (const id of this.voices.keys()) this.remove(id)
    void this.context?.suspend().catch(() => {})
    this.onPlaying(false)
  }

  close() {
    this.stop()
    if (this.context) this.context.onstatechange = null
    void this.context?.close().catch(() => {})
    this.context = null
    this.output = null
    this.buffers.clear()
    this.loading.clear()
  }

  private remove(id: AmbientId) {
    const voice = this.voices.get(id)
    if (!voice) return
    voice.source.stop()
    voice.source.disconnect()
    voice.gain.disconnect()
    this.voices.delete(id)
  }

  private buffer(id: AmbientId): Promise<AudioBuffer> {
    const cached = this.buffers.get(id)
    if (cached) return Promise.resolve(cached)
    const loading = this.loading.get(id)
    if (loading) return loading
    const ctx = this.context!
    const sound = AMBIENT_SOUNDS.find((item) => item.id === id)!
    const task = fetch(sound.url)
      .then((response) => {
        if (!response.ok) throw new Error('Recording unavailable')
        const length = Number(response.headers?.get('Content-Length') ?? 0)
        if (length > 2_000_000) throw new Error('Recording exceeds transfer budget')
        return response.arrayBuffer()
      })
      .then((bytes) => {
        if (bytes.byteLength > 2_000_000) throw new Error('Recording exceeds transfer budget')
        return ctx.decodeAudioData(bytes)
      })
      .then((buffer) => {
        // Shipped mono loops are <=48s. Reject unexpectedly large replacement assets.
        if (buffer.duration > 50 || buffer.numberOfChannels > 2)
          throw new Error('Recording exceeds decode budget')
        if (ctx === this.context) this.buffers.set(id, buffer)
        return buffer
      })
      .finally(() => this.loading.delete(id))
    this.loading.set(id, task)
    return task
  }
}
