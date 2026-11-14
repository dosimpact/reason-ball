import type { SceneInteractiveObject, SceneObjectReactionFrame } from './sceneInteractiveTypes.ts'

type Activation = {
  object: SceneInteractiveObject
  elapsedMs: number
  durationMs: number
  trigger: number
  reducedMotion: boolean
}

/** Ephemeral per-scene input state. Advancing time alone can never start a reaction.
 * No timers, sound, persistence, rewards or connection to the autonomous animal simulation. */
export class SceneObjectInteractionController {
  private readonly objects = new Map<string, SceneInteractiveObject>()
  private readonly active = new Map<string, Activation>()
  private readonly triggers = new Map<string, number>()
  private disposed = false

  constructor(objects: readonly SceneInteractiveObject[]) {
    for (const object of objects) {
      if (this.objects.has(object.id)) throw new Error(`Duplicate interactive object: ${object.id}`)
      if (!Number.isFinite(object.reaction.durationMs) || object.reaction.durationMs <= 0)
        throw new Error(`Invalid reaction duration: ${object.id}`)
      this.objects.set(object.id, object)
    }
  }

  get activeCount() {
    return this.active.size
  }

  activate(id: string, options: { reducedMotion?: boolean } = {}): boolean {
    if (this.disposed) return false
    const object = this.objects.get(id)
    if (!object) return false
    // Ignore duplicate browser/input delivery and very rapid presses on the same prop.
    const previous = this.active.get(id)
    if (previous && previous.elapsedMs < 160) return false
    const trigger = (this.triggers.get(id) ?? 0) + 1
    this.triggers.set(id, trigger)
    const reducedMotion = options.reducedMotion ?? false
    this.active.set(id, {
      object,
      elapsedMs: 0,
      durationMs: reducedMotion
        ? Math.min(220, object.reaction.durationMs)
        : object.reaction.durationMs,
      trigger,
      reducedMotion,
    })
    return true
  }

  advance(deltaMs: number): void {
    if (this.disposed || !Number.isFinite(deltaMs) || deltaMs <= 0) return
    for (const [id, activation] of this.active) {
      activation.elapsedMs += deltaMs
      if (activation.elapsedMs >= activation.durationMs) this.active.delete(id)
    }
  }

  frame(id: string): SceneObjectReactionFrame | undefined {
    const activation = this.active.get(id)
    if (!activation) return undefined
    const progress = activation.elapsedMs / activation.durationMs
    return {
      id,
      type: activation.object.reaction.type,
      progress,
      intensity: Math.sin(Math.PI * progress) * (activation.object.reaction.strength ?? 1),
      elapsedMs: activation.elapsedMs,
      durationMs: activation.durationMs,
      trigger: activation.trigger,
      reducedMotion: activation.reducedMotion,
    }
  }

  clear(): void {
    this.active.clear()
  }

  dispose(): void {
    this.clear()
    this.triggers.clear()
    this.objects.clear()
    this.disposed = true
  }
}
