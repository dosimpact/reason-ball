type Cue = 'print' | 'cup'
type Options = {
  createContext?: () => AudioContext | null
  setTimeout?: (callback: () => void, delay: number) => unknown
  clearTimeout?: (token: unknown) => void
}
function browserContext(): AudioContext | null {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }
  const Context = scope.AudioContext ?? scope.webkitAudioContext
  return Context ? new Context() : null
}
/** Quiet synthesized UI cues. No context, allocation or playback before unlock's user gesture. */
export class RitualAudio {
  private context: AudioContext | null = null
  private unlocked = false
  private unlocking: Promise<boolean> | null = null
  private muted = false
  private disposed = false
  private printGeneration = 0
  private printerBuffer: AudioBuffer | null = null
  private active = new Map<Cue, () => void>()
  private options: Required<Options>
  constructor(options: Options = {}) {
    this.options = {
      createContext: options.createContext ?? browserContext,
      setTimeout:
        options.setTimeout ?? ((callback, delay) => globalThis.setTimeout(callback, delay)),
      clearTimeout:
        options.clearTimeout ??
        ((token) => globalThis.clearTimeout(token as ReturnType<typeof setTimeout>)),
    }
  }
  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) {
      this.cancelPrint()
      for (const cleanup of [...this.active.values()]) cleanup()
    }
  }
  unlock(): Promise<boolean> {
    if (this.disposed || this.muted) return Promise.resolve(false)
    if (this.unlocking) return this.unlocking
    this.unlocking = this.activate().finally(() => {
      this.unlocking = null
    })
    return this.unlocking
  }
  private async activate(): Promise<boolean> {
    try {
      this.context ??= this.options.createContext()
      const context = this.context
      if (!context || context.state === 'closed') return false
      if (context.state !== 'running') await context.resume()
      this.unlocked = !this.disposed && !this.muted && context.state === 'running'
      return this.unlocked
    } catch {
      this.unlocked = false
      return false
    }
  }
  print(short = false): void {
    this.play('print', short)
  }
  async printWhenReady(short = false): Promise<void> {
    const generation = this.printGeneration
    if (await this.unlock()) {
      if (generation === this.printGeneration) this.print(short)
    }
  }
  cancelPrint(): void {
    this.printGeneration++
    this.active.get('print')?.()
  }
  cup(): void {
    this.play('cup')
  }
  private play(kind: Cue, short = false): void {
    const context = this.context
    if (
      this.disposed ||
      this.muted ||
      !this.unlocked ||
      !context ||
      context.state !== 'running' ||
      this.active.has(kind)
    )
      return
    const sources: AudioScheduledSourceNode[] = [],
      nodes: AudioNode[] = []
    let token: unknown,
      finished = false,
      ended = 0
    const cleanup = () => {
      if (finished) return
      finished = true
      if (token !== undefined) this.options.clearTimeout(token)
      for (const source of sources) {
        source.onended = null
        try {
          source.stop()
        } catch {}
      }
      for (const node of nodes) {
        try {
          node.disconnect()
        } catch {}
      }
      this.active.delete(kind)
    }
    try {
      const now = context.currentTime,
        duration = kind === 'print' ? (short ? 0.12 : 0.45) : 0.18
      const gain = context.createGain()
      nodes.push(gain)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(kind === 'print' ? 0.055 : 0.028, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      gain.connect(context.destination)
      if (kind === 'print') {
        if (!this.printerBuffer) {
          const rate = Math.min(48000, Math.max(8000, context.sampleRate))
          this.printerBuffer = context.createBuffer(1, Math.ceil(rate * 0.45), rate)
          const data = this.printerBuffer.getChannelData(0)
          let seed = 97
          for (let index = 0; index < data.length; index++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
            const pulse = (index / rate) % 0.15 < 0.105 ? 0.65 : 0.08
            data[index] = (seed / 2147483648 - 1) * pulse
          }
        }
        const noise = context.createBufferSource(),
          filter = context.createBiquadFilter()
        sources.push(noise)
        nodes.push(noise, filter)
        noise.buffer = this.printerBuffer
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(1700, now)
        filter.Q.setValueAtTime(0.7, now)
        noise.connect(filter)
        filter.connect(gain)
      }
      const tone = context.createOscillator()
      sources.push(tone)
      nodes.push(tone)
      tone.type = kind === 'print' ? 'triangle' : 'sine'
      tone.frequency.setValueAtTime(kind === 'print' ? 115 : 1100, now)
      tone.frequency.exponentialRampToValueAtTime(kind === 'print' ? 85 : 730, now + duration)
      if (kind === 'print') {
        const motor = context.createGain()
        nodes.push(motor)
        motor.gain.setValueAtTime(0.28, now)
        tone.connect(motor)
        motor.connect(gain)
      } else tone.connect(gain)
      this.active.set(kind, cleanup)
      for (const source of sources) {
        source.onended = () => {
          if (++ended >= sources.length) cleanup()
        }
        source.start(now)
        source.stop(now + duration)
      }
      token = this.options.setTimeout(cleanup, Math.ceil((duration + 0.1) * 1000))
    } catch {
      cleanup()
    }
  }
  dispose(): void {
    if (this.disposed) return
    this.cancelPrint()
    this.disposed = true
    this.unlocked = false
    for (const cleanup of [...this.active.values()]) cleanup()
    this.printerBuffer = null
    const context = this.context
    this.context = null
    try {
      void context?.close().catch(() => {})
    } catch {}
  }
}
