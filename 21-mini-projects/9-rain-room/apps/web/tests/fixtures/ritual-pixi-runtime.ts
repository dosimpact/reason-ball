/** Test boundary: only the GPU owner is replaced; real React scene/status wiring remains. */
type Options = {
  id: string
  host: HTMLElement
  onStatus?: (status: 'loading' | 'ready' | 'error', message?: string) => void
}
export class PixiSceneRuntime {
  private options: Options
  private canvas: HTMLCanvasElement | null = null
  private disposed = false
  private ready = () => {
    if (!this.disposed) this.options.onStatus?.('ready')
  }
  private error = () => {
    if (!this.disposed) this.options.onStatus?.('error', 'Test GPU load failure')
  }
  private stats: {
    constructed: number
    started: number
    destroyed: number
    alive: number
    maxAlive: number
  }
  constructor(options: Options) {
    this.options = options
    const scope = window as unknown as { __ritualGpu: typeof this.stats }
    this.stats = scope.__ritualGpu ??= {
      constructed: 0,
      started: 0,
      destroyed: 0,
      alive: 0,
      maxAlive: 0,
    }
    this.stats.constructed++
    this.stats.alive++
    this.stats.maxAlive = Math.max(this.stats.maxAlive, this.stats.alive)
  }
  async start() {
    if (this.disposed) return
    this.stats.started++
    this.canvas = document.createElement('canvas')
    this.canvas.dataset.testGpu = 'true'
    this.canvas.dataset.backgroundId = this.options.id
    this.options.host.append(this.canvas)
    window.addEventListener('test-scene-ready', this.ready)
    window.addEventListener('test-scene-error', this.error)
    this.options.onStatus?.('loading')
  }
  activateSceneObject(id: string) {
    const control = (
      window as unknown as { __ritualObjectActivation?: { accepted: boolean; calls: string[] } }
    ).__ritualObjectActivation
    control?.calls.push(id)
    return Boolean(control?.accepted && !this.disposed)
  }
  resize() {}
  setPaused(_value: boolean) {}
  setCoffeeCount(_value: number) {}
  destroy() {
    if (this.disposed) return
    this.disposed = true
    this.stats.destroyed++
    this.stats.alive--
    window.removeEventListener('test-scene-ready', this.ready)
    window.removeEventListener('test-scene-error', this.error)
    this.canvas?.remove()
    this.canvas = null
  }
}
