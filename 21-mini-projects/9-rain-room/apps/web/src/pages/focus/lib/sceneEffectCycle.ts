export type EffectState = { yawn: boolean; gust: boolean; lightning: boolean }
export const REST_EFFECTS: EffectState = { yawn: false, gust: false, lightning: false }
type Range = readonly [number, number]
type Clock = { set: (callback: () => void, delay: number) => unknown; clear: (id: unknown) => void }
/** One owner per visible scene; pause invalidates all delayed work, including active effects. */
export class SceneEffectCycle {
  private tasks = new Set<unknown>()
  private generation = 0
  private emit: (state: EffectState) => void
  private clock: Clock
  private random: () => number
  constructor(emit: (state: EffectState) => void, clock: Clock, random = Math.random) {
    this.emit = emit
    this.clock = clock
    this.random = random
  }
  start(
    cat: boolean,
    storm: boolean,
    gustDelay: Range,
    gustDuration: Range,
    lightningDelay: Range,
    yawnDelay: Range = [35000, 90000],
    yawnDuration = 2400,
  ) {
    this.stop()
    const generation = this.generation
    const schedule = (fn: () => void, range: Range) => {
      const id = this.clock.set(
        () => {
          this.tasks.delete(id)
          if (generation === this.generation) fn()
        },
        range[0] + this.random() * (range[1] - range[0]),
      )
      this.tasks.add(id)
    }
    let state = { ...REST_EFFECTS }
    let rainSwell = false
    let stormSwell = false
    const update = (patch: Partial<EffectState>) => {
      state = { ...state, ...patch }
      this.emit(state)
    }
    const yawn = () =>
      schedule(() => {
        update({ yawn: true })
        schedule(() => {
          update({ yawn: false })
          yawn()
        }, [yawnDuration, yawnDuration])
      }, yawnDelay)
    const gust = () =>
      schedule(() => {
        rainSwell = true
        update({ gust: true })
        schedule(() => {
          rainSwell = false
          update({ gust: stormSwell })
          gust()
        }, gustDuration)
      }, gustDelay)
    // A single slow flash accompanies a temporary rain swell; never a strobe.
    const lightning = () =>
      schedule(() => {
        stormSwell = true
        update({ lightning: true, gust: true })
        schedule(() => update({ lightning: false }), [2600, 2600])
        schedule(() => {
          stormSwell = false
          update({ gust: rainSwell })
          lightning()
        }, gustDuration)
      }, lightningDelay)
    if (cat) yawn()
    if (storm) {
      gust()
      lightning()
    }
  }
  stop() {
    this.generation++
    for (const id of this.tasks) this.clock.clear(id)
    this.tasks.clear()
    this.emit({ ...REST_EFFECTS })
  }
}
