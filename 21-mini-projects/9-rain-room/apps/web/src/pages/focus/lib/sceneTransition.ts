export const SCENE_FADE_OUT_MS = 240
export const SCENE_FADE_IN_MS = 600
export const SCENE_LOAD_TIMEOUT_MS = 15000
export type SceneTransitionPhase = 'idle' | 'fading-out' | 'loading' | 'fading-in'
export type SceneStatus = 'loading' | 'ready' | 'error' | 'paused'
export type SceneTransitionState = {
  displayedId: string
  generation: number
  timedOut: boolean
  phase: SceneTransitionPhase
}
export type SceneTransitionScheduler = {
  delay(callback: () => void, milliseconds: number): unknown
  cancelDelay(token: unknown): void
  frame(callback: () => void): unknown
  cancelFrame(token: unknown): void
}
const browserScheduler: SceneTransitionScheduler = {
  delay: (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
  cancelDelay: (token) => globalThis.clearTimeout(token as ReturnType<typeof setTimeout>),
  frame: (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame: (token) => globalThis.cancelAnimationFrame(token as number),
}
/** One displayed scene: black is painted before swapping, and ready is painted
 * before revealing. The controller never owns or duplicates a canvas/audio/timer. */
export class SceneTransitionController {
  private state: SceneTransitionState
  private target: string
  private currentStatus: SceneStatus = 'loading'
  private disposed = false
  private reduced: boolean
  private scheduler: SceneTransitionScheduler
  private onChange: (state: SceneTransitionState) => void
  private onStatus: (status: SceneStatus) => void
  private outTimer: unknown = null
  private loadTimer: unknown = null
  private inTimer: unknown = null
  private frames = new Set<unknown>()
  private retryPending = false
  private revealing = false
  constructor({
    initialId,
    reducedMotion = false,
    onChange,
    onStatus = () => {},
    scheduler = browserScheduler,
  }: {
    initialId: string
    reducedMotion?: boolean
    onChange: (state: SceneTransitionState) => void
    onStatus?: (status: SceneStatus) => void
    scheduler?: SceneTransitionScheduler
  }) {
    this.state = { displayedId: initialId, generation: 0, phase: 'idle', timedOut: false }
    this.target = initialId
    this.reduced = reducedMotion
    this.scheduler = scheduler
    this.onChange = onChange
    this.onStatus = onStatus
  }
  snapshot() {
    return { ...this.state }
  }
  private emit() {
    if (!this.disposed) this.onChange(this.snapshot())
  }
  private clearTimer(kind: 'outTimer' | 'loadTimer' | 'inTimer') {
    if (this[kind] !== null) this.scheduler.cancelDelay(this[kind])
    this[kind] = null
  }
  private clearFrames() {
    for (const token of this.frames) this.scheduler.cancelFrame(token)
    this.frames.clear()
    this.revealing = false
  }
  private afterFrames(count: number, callback: () => void) {
    if (this.disposed) return
    const token = this.scheduler.frame(() => {
      this.frames.delete(token)
      if (this.disposed) return
      if (count > 1) this.afterFrames(count - 1, callback)
      else callback()
    })
    this.frames.add(token)
  }
  request(id: string) {
    if (this.disposed || id === this.target) return
    this.target = id
    this.state.timedOut = false
    this.clearTimer('loadTimer')
    if (this.state.phase === 'fading-out') return // existing fade resolves the latest target
    this.clearFrames()
    if (this.state.phase === 'loading') {
      // Already opaque: latest external selection replaces the pending scene.
      this.afterFrames(1, () => this.swapCovered())
      return
    }
    this.clearTimer('inTimer')
    this.state.phase = 'fading-out'
    this.emit()
    this.coverThenSwap()
  }
  retry() {
    if (this.disposed || this.state.phase !== 'idle' || !this.state.timedOut) return
    this.retryPending = true
    this.state.timedOut = false
    this.state.phase = 'fading-out'
    this.emit()
    this.coverThenSwap()
  }
  private coverThenSwap() {
    this.clearTimer('outTimer')
    const covered = () => {
      this.outTimer = null
      // A full frame paints black over the OLD scene before a second frame swaps it.
      this.afterFrames(2, () => this.swapCovered())
    }
    if (this.reduced) covered()
    else this.outTimer = this.scheduler.delay(covered, SCENE_FADE_OUT_MS)
  }
  private swapCovered() {
    if (this.disposed) return
    this.clearTimer('loadTimer')
    this.revealing = false
    if (this.target !== this.state.displayedId || this.retryPending) {
      this.state.displayedId = this.target
      this.retryPending = false
      this.state.generation++
      this.currentStatus = 'loading'
    }
    this.state.phase = 'loading'
    this.emit()
    if (this.disposed) return
    this.loadTimer = this.scheduler.delay(() => {
      this.loadTimer = null
      if (this.disposed || this.state.phase !== 'loading') return
      this.currentStatus = 'error'
      this.state.timedOut = true
      this.emit()
      this.onStatus('error')
      this.revealWhenPainted()
    }, SCENE_LOAD_TIMEOUT_MS)
    if (this.currentStatus === 'ready' || this.currentStatus === 'error') this.revealWhenPainted()
  }
  status(id: string, generation: number, status: SceneStatus) {
    if (this.disposed || id !== this.state.displayedId || generation !== this.state.generation)
      return
    this.currentStatus = status
    if (status === 'ready' && this.state.timedOut) {
      this.state.timedOut = false
      this.emit()
    }
    if (this.target !== this.state.displayedId) return
    this.onStatus(status)
    if (
      this.state.phase === 'loading' &&
      this.revealing &&
      status !== 'ready' &&
      status !== 'error'
    )
      this.clearFrames()
    if (this.state.phase === 'loading' && (status === 'ready' || status === 'error'))
      this.revealWhenPainted()
  }
  private revealWhenPainted() {
    if (this.disposed || this.revealing || this.target !== this.state.displayedId) return
    this.revealing = true
    const id = this.state.displayedId,
      generation = this.state.generation
    this.afterFrames(2, () => {
      this.revealing = false
      if (
        this.state.phase !== 'loading' ||
        this.target !== id ||
        this.state.generation !== generation ||
        (this.currentStatus !== 'ready' && this.currentStatus !== 'error')
      )
        return
      this.clearTimer('loadTimer')
      this.state.phase = 'fading-in'
      this.emit()
      const finish = () => {
        this.inTimer = null
        if (this.disposed || this.state.phase !== 'fading-in') return
        this.state.phase = 'idle'
        this.emit()
      }
      if (this.reduced) this.afterFrames(1, finish)
      else this.inTimer = this.scheduler.delay(finish, SCENE_FADE_IN_MS)
    })
  }
  setReducedMotion(value: boolean) {
    if (this.disposed || this.reduced === value) return
    this.reduced = value
    if (value && this.state.phase === 'fading-out') {
      this.clearFrames()
      this.coverThenSwap()
    } else if (value && this.state.phase === 'fading-in') {
      this.clearTimer('inTimer')
      this.clearFrames()
      this.state.phase = 'idle'
      this.emit()
    }
  }
  destroy() {
    if (this.disposed) return
    this.disposed = true
    this.clearTimer('outTimer')
    this.clearTimer('loadTimer')
    this.clearTimer('inTimer')
    this.clearFrames()
  }
}
