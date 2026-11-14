import type * as Pixi from 'pixi.js'
import { AnimalLifeSimulation } from '../model/animalLife.ts'
import type { AnimalHabitat } from '../model/animalHabitats.ts'
import {
  animalRig,
  animalResourceSvg,
  animalTetherLine,
  animalPartSvg,
  animalPartPose,
  type AnimalPart,
  type AnimalDrawingState,
} from './animalDrawing.ts'
export function createPixiAnimalLife({
  plan,
  pixi,
  seed = 1,
}: {
  plan: AnimalHabitat
  pixi: typeof Pixi
  seed?: number
}) {
  const simulation = new AnimalLifeSimulation(plan, seed)
  const roots = new Map<string, Pixi.Container>()
  const slots = new Map<string, Pixi.Container>()
  const parts = new Map<string, { part: AnimalPart; node: Pixi.Graphics }[]>()
  const contexts = new Map<string, Pixi.GraphicsContext>()
  const zones = new Map(plan.zones.map((zone) => [zone.id, zone]))
  const specs = new Map(
    plan.actors.map((actor) => [
      actor.id,
      { ...actor, tetherAnchor: zones.get(actor.zoneId)?.anchor },
    ]),
  )
  const tethers = new Map<string, Pixi.Graphics>()
  let previous = simulation.snapshot(),
    current = previous
  let disposed = false,
    accumulator = 0
  const destroy = () => {
    if (disposed) return
    disposed = true
    simulation.dispose()
    for (const root of slots.values()) {
      try {
        root.removeFromParent()
        root.destroy({ children: true, context: false })
      } catch {}
    }
    roots.clear()
    slots.clear()
    parts.clear()
    tethers.clear()
    for (const context of contexts.values()) {
      try {
        context.destroy()
      } catch {}
    }
    contexts.clear()
  }
  const graphic = (svg: string) => {
    let context = contexts.get(svg)
    if (!context) {
      context = new pixi.GraphicsContext()
      contexts.set(svg, context)
      context.svg(svg)
      // Installed SVGParser lists but does not apply cap/join/miter attributes.
      for (const instruction of context.instructions)
        if (instruction.action === 'stroke')
          instruction.data.style = {
            ...instruction.data.style,
            cap: 'round',
            join: 'round',
            miterLimit: 4,
          }
    }
    return new pixi.Graphics(context)
  }
  try {
    const stationZones = new Set<string>()
    for (const spec of plan.actors) {
      const slot = new pixi.Container()
      slots.set(spec.id, slot)
      const zone = plan.zones.find((zone) => zone.id === spec.zoneId)!
      if (!stationZones.has(zone.id)) {
        stationZones.add(zone.id)
        for (const resource of plan.resources.filter(
          (resource) => resource.zoneId === zone.id && resource.kind !== 'rest',
        )) {
          const consumer = plan.actors.find((actor) => actor.id === resource.consumerId)
          slot.addChild(
            graphic(
              animalResourceSvg(
                {
                  ...resource,
                  scale: consumer?.scale,
                  species: consumer?.species,
                },
                zone,
              ),
            ),
          )
        }
      }
      if (spec.species === 'spider' && zone.anchor) {
        const context = new pixi.GraphicsContext()
        contexts.set(`tether:${spec.id}`, context)
        const tether = new pixi.Graphics(context)
        tethers.set(spec.id, tether)
        slot.addChild(tether)
      }
      const root = new pixi.Container()
      roots.set(spec.id, root)
      slot.addChild(root)
      const rig = []
      for (const part of animalRig(spec)) {
        const node = graphic(animalPartSvg(part))
        root.addChild(node)
        rig.push({ part, node })
      }
      parts.set(spec.id, rig)
    }
  } catch (error) {
    destroy()
    throw error
  }
  const paint = () => {
    if (disposed) return
    const alpha = Math.min(1, accumulator / 0.1)
    const old = new Map(previous.map((state) => [state.id, state]))
    for (const next of current) {
      const before = old.get(next.id) ?? next
      const gaitDelta = (next.gaitPhase - before.gaitPhase + 1) % 1
      const state = {
        ...next,
        domain: zones.get(next.zoneId)?.domain,
        x: before.x + (next.x - before.x) * alpha,
        y: before.y + (next.y - before.y) * alpha,
        time: before.time + (next.time - before.time) * alpha,
        gaitPhase: (before.gaitPhase + gaitDelta * alpha) % 1,
        phase:
          before.action === next.action
            ? before.phase + (next.phase - before.phase) * alpha
            : next.phase,
      }
      const spec = specs.get(state.id)!
      const root = roots.get(state.id)
      if (!root) continue
      const tether = tethers.get(state.id),
        thread = animalTetherLine(spec, state)
      if (tether && thread)
        tether
          .clear()
          .moveTo(thread.x1, thread.y1)
          .lineTo(thread.x2, thread.y2)
          .stroke({ color: thread.color, width: thread.width, alpha: thread.alpha, cap: 'round' })
      root.position.set(state.x, state.y)
      root.scale.set(spec.scale * (state.heading < 0 ? -1 : 1), spec.scale)
      for (const { part, node } of parts.get(state.id) ?? []) {
        const pose = animalPartPose(part, state as AnimalDrawingState)
        node.position.set(pose.x, pose.y)
        node.rotation = pose.rotation
        node.scale.set(pose.scaleX, pose.scaleY)
        node.alpha = pose.alpha
      }
    }
  }
  paint()
  return {
    getNode: (id: string) => slots.get(id),
    update(deltaSeconds: number) {
      if (disposed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
      accumulator += Math.min(0.1, deltaSeconds)
      while (accumulator + 1e-9 >= 0.1) {
        previous = current
        simulation.step(0.1)
        current = simulation.snapshot()
        accumulator = Math.max(0, accumulator - 0.1)
      }
      paint()
    },
    snapshot: () => simulation.snapshot(),
    interact(id: string) {
      if (!disposed) {
        simulation.interact(id)
        previous = current = simulation.snapshot()
        paint()
      }
    },
    destroy,
  }
}
