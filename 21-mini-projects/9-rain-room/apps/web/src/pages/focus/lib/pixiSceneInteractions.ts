import type { Container, Graphics, GraphicsContext } from 'pixi.js'
import type {
  SceneInteractiveObject,
  SceneObjectReactionFrame,
} from '../model/sceneInteractiveTypes.ts'
import { SceneObjectInteractionController } from '../model/sceneObjectInteraction.ts'
import type { SceneWorldFrame } from '../model/sceneWorldCamera.ts'
import {
  sceneInteractiveArtSvg,
  sceneInteractiveEffectSvg,
  sceneInteractivePose,
  type ScenePropTransform,
} from './sceneInteractiveDrawing.ts'

export type SceneObjectTarget = {
  id: string
  left: number
  top: number
  width: number
  height: number
}
/** Only visible art gets a target; enlarged touch bounds never create offscreen Tab stops. */
export function projectSceneObjectTarget(
  object: SceneInteractiveObject,
  frame: SceneWorldFrame,
): SceneObjectTarget | null {
  const s = object.scale * frame.scale
  const bounds = object.interactionBounds ?? { x: 0, y: 0, width: 96, height: 96 }
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.x < 0 ||
    bounds.y < 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    bounds.x + bounds.width > 96 ||
    bounds.y + bounds.height > 96
  )
    return null
  const left = frame.x + (object.position.x + (bounds.x - 48) * object.scale) * frame.scale
  const top = frame.y + (object.position.y + (bounds.y - 88) * object.scale) * frame.scale
  const artWidth = bounds.width * s,
    artHeight = bounds.height * s
  const viewportWidth = frame.viewportWorld.width * frame.scale
  const viewportHeight = frame.viewportWorld.height * frame.scale
  // The core's native mask also clips these props.
  const coreLeft = Math.max(0, frame.x),
    coreTop = Math.max(0, frame.y)
  const coreRight = Math.min(viewportWidth, frame.x + 800 * frame.scale)
  const coreBottom = Math.min(viewportHeight, frame.y + 820 * frame.scale)
  const visibleLeft = Math.max(left, coreLeft),
    visibleTop = Math.max(top, coreTop)
  const visibleRight = Math.min(left + artWidth, coreRight),
    visibleBottom = Math.min(top + artHeight, coreBottom)
  if (
    ![s, left, top, artWidth, artHeight].every(Number.isFinite) ||
    s <= 0 ||
    visibleRight <= visibleLeft ||
    visibleBottom <= visibleTop
  )
    return null
  const width = Math.min(viewportWidth, Math.max(44, visibleRight - visibleLeft))
  const height = Math.min(viewportHeight, Math.max(44, visibleBottom - visibleTop))
  return {
    id: object.id,
    left: Math.max(0, Math.min(viewportWidth - width, (visibleLeft + visibleRight - width) / 2)),
    top: Math.max(0, Math.min(viewportHeight - height, (visibleTop + visibleBottom - height) / 2)),
    width,
    height,
  }
}
/** Pointer sequences may become scrolls or drags; activation happens once, from click only. */
export class SceneObjectPointerGesture {
  private start: { x: number; y: number; id: number } | null = null
  private cancelled = false
  private pressed = false
  down(x: number, y: number, id: number) {
    this.start = { x, y, id }
    this.cancelled = false
    this.pressed = true
  }
  up(id: number) {
    if (this.start?.id === id) this.pressed = false
  }
  leave() {
    if (this.pressed) this.cancel()
  }
  move(x: number, y: number, id: number) {
    if (this.start?.id === id && Math.hypot(x - this.start.x, y - this.start.y) > 8)
      this.cancelled = true
  }
  cancel() {
    this.cancelled = true
    this.pressed = false
    this.start = null
  }
  click(keyboard = false) {
    const allowed = keyboard || !this.cancelled
    this.start = null
    this.pressed = false
    this.cancelled = false
    return allowed
  }
}
function apply(node: Container, pose: ScenePropTransform, x: number, y: number) {
  node.position.set(x + pose.x, y + pose.y)
  node.rotation = pose.rotation
  node.scale.set(pose.scaleX, pose.scaleY)
  node.alpha = pose.alpha
  node.visible = pose.alpha > 0
}
/** Native graphics are compiled at setup; reaction frames change transforms and opacity only. */
export function createPixiSceneInteractions(
  objects: readonly SceneInteractiveObject[],
  pixi: typeof import('pixi.js'),
) {
  const container = new pixi.Container(),
    controller = new SceneObjectInteractionController(objects)
  const contexts: GraphicsContext[] = [],
    drawings: Graphics[] = [],
    nodes = new Map<
      string,
      { object: SceneInteractiveObject; subject: Graphics; effects: Graphics[] }
    >()
  const active = new Set<string>()
  let disposed = false
  container.eventMode = 'none'
  const compile = (svg: string) => {
    const context = new pixi.GraphicsContext()
    contexts.push(context)
    context.svg(sceneInteractiveArtSvg(svg))
    for (const instruction of context.instructions)
      if (instruction.action === 'stroke')
        instruction.data.style = { ...instruction.data.style, miterLimit: 4 }
    return context
  }
  const update = (id: string, frame?: SceneObjectReactionFrame) => {
    const rig = nodes.get(id)
    if (!rig) return
    const pivot = rig.object.art.pivot ?? { x: 48, y: 78 },
      pose = sceneInteractivePose(rig.object, frame)
    apply(rig.subject, pose.subject, pivot.x, pivot.y)
    rig.effects.forEach((effect, i) => apply(effect, pose.effects[i]!, 48, 48))
  }
  const destroy = () => {
    if (disposed) return
    disposed = true
    controller.dispose()
    active.clear()
    container.removeFromParent()
    // Explicit ownership keeps shared FX contexts alive until all their instances are gone.
    for (const drawing of drawings) drawing.destroy({ context: false })
    container.destroy({ children: true })
    for (const context of contexts) context.destroy()
    nodes.clear()
  }
  try {
    for (const object of objects) {
      const holder = new pixi.Container()
      holder.position.set(
        object.position.x - 48 * object.scale,
        object.position.y - 88 * object.scale,
      )
      holder.scale.set(object.scale)
      container.addChild(holder)
      const base = new pixi.Graphics(compile(object.art.base))
      drawings.push(base)
      holder.addChild(base)
      const subject = new pixi.Graphics(compile(object.art.subject)),
        pivot = object.art.pivot ?? { x: 48, y: 78 }
      drawings.push(subject)
      subject.pivot.set(pivot.x, pivot.y)
      holder.addChild(subject)
      const effectContext = compile(sceneInteractiveEffectSvg(object))
      const effects = Array.from({ length: 3 }, () => {
        const effect = new pixi.Graphics(effectContext)
        drawings.push(effect)
        effect.pivot.set(48, 48)
        holder.addChild(effect)
        return effect
      })
      nodes.set(object.id, { object, subject, effects })
      update(object.id)
    }
  } catch (error) {
    destroy()
    throw error
  }
  return {
    container,
    get activeCount() {
      return controller.activeCount
    },
    activate(id: string, reducedMotion = false) {
      if (disposed || !controller.activate(id, { reducedMotion })) return false
      active.add(id)
      update(id, controller.frame(id))
      return true
    },
    advance(deltaMs: number) {
      if (disposed || !active.size) return
      controller.advance(deltaMs)
      for (const id of active) {
        const frame = controller.frame(id)
        update(id, frame)
        if (!frame || frame.progress >= 1) active.delete(id)
      }
    },
    clear() {
      controller.clear()
      for (const id of active) update(id)
      active.clear()
    },
    frame: (id: string) => controller.frame(id),
    destroy,
  }
}
