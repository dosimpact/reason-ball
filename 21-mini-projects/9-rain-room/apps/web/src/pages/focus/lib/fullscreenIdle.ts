export const FULLSCREEN_IDLE_MS = 2500
export class FullscreenIdle {
  private timer: ReturnType<typeof setTimeout> | null = null
  private holds = new Set<string>()
  private disposed = false
  private onVisible: (visible: boolean) => void
  private schedule: typeof setTimeout
  private cancel: typeof clearTimeout
  constructor(
    onVisible: (visible: boolean) => void,
    schedule = globalThis.setTimeout.bind(globalThis),
    cancel = globalThis.clearTimeout.bind(globalThis),
  ) {
    this.onVisible = onVisible
    this.schedule = schedule
    this.cancel = cancel
  }
  reveal() {
    if (this.disposed) return
    this.clear()
    this.onVisible(true)
    if (!this.holds.size)
      this.timer = this.schedule(() => {
        this.timer = null
        if (!this.disposed) this.onVisible(false)
      }, FULLSCREEN_IDLE_MS)
  }
  hold(reason: string) {
    this.holds.add(reason)
    this.reveal()
  }
  release(reason: string) {
    this.holds.delete(reason)
    this.reveal()
  }
  destroy() {
    this.disposed = true
    this.clear()
    this.holds.clear()
  }
  private clear() {
    if (this.timer !== null) this.cancel(this.timer)
    this.timer = null
  }
}
