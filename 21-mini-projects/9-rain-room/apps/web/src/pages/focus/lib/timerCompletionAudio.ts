/** A one-shot cue graph, intentionally separate from both music and ambient mixer gains. */
export class TimerCompletionAudio {
  private context: AudioContext | null = null
  private voices = new Set<{ oscillator: OscillatorNode; gain: GainNode }>()
  private disposed = false
  private generation = 0
  private createContext: () => AudioContext | null
  constructor(
    createContext: () => AudioContext | null = () => {
      const Constructor =
        globalThis.AudioContext ??
        (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      return Constructor ? new Constructor() : null
    },
  ) {
    this.createContext = createContext
  }
  get prepared() {
    return this.context !== null && this.context.state !== 'closed'
  }
  /** Called synchronously from a start/resume (or restored-running interaction) gesture. */
  prepare() {
    if (this.disposed) return
    try {
      if (!this.context || this.context.state === 'closed') this.context = this.createContext()
      if (this.context) void Promise.resolve(this.context.resume()).catch(() => {})
    } catch {
      /* Timer remains usable when Web Audio or activation is unavailable. */
    }
  }
  play() {
    const context = this.context
    if (this.disposed || !context || context.state === 'closed') return
    if (context.state === 'running') {
      this.schedule(context)
      return
    }
    const generation = this.generation
    try {
      void Promise.resolve(context.resume())
        .then(() => {
          if (generation === this.generation && this.context === context) this.schedule(context)
        })
        .catch(() => {})
    } catch {
      /* A blocked context must not interrupt completion or reject unhandled. */
    }
  }
  private schedule(context: AudioContext) {
    if (this.disposed || context.state !== 'running') return
    const start = context.currentTime + 0.015
    try {
      for (let index = 0; index < 4; index++) {
        const oscillator = context.createOscillator(),
          gain = context.createGain()
        const voice = { oscillator, gain }
        this.voices.add(voice)
        const at = start + index * 0.14,
          duration = index === 3 ? 0.14 : 0.085
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(880, at)
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(0.08, at + 0.008)
        gain.gain.setValueAtTime(0.08, at + duration - 0.02)
        gain.gain.linearRampToValueAtTime(0, at + duration)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.onended = () => {
          oscillator.disconnect()
          gain.disconnect()
          this.voices.delete(voice)
        }
        oscillator.start(at)
        oscillator.stop(at + duration + 0.01)
      }
    } catch {
      this.stopVoices()
    }
  }
  private stopVoices() {
    for (const { oscillator, gain } of this.voices) {
      oscillator.onended = null
      try {
        oscillator.stop()
      } catch {}
      try {
        oscillator.disconnect()
        gain.disconnect()
      } catch {}
    }
    this.voices.clear()
  }
  cancel() {
    this.generation++
    this.stopVoices()
  }
  dispose() {
    this.disposed = true
    this.generation++
    this.stopVoices()
    const context = this.context
    this.context = null
    try {
      if (context && context.state !== 'closed')
        void Promise.resolve(context.close()).catch(() => {})
    } catch {}
  }
}
