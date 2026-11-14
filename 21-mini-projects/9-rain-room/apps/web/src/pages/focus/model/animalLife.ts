import {
  createPetRoutine,
  nextPetAction,
  petActionDuration,
  type PetRoutine,
} from './petRoutine.ts'
import {
  ANIMAL_SPECIES,
  type AnimalAction,
  type AnimalEmotion,
  type AnimalDomain,
} from './animalSpecies.ts'
import type { AnimalHabitat, AnimalSpec, NavZone, Point } from './animalHabitats.ts'
export type AnimalNeeds = { hunger: number; fatigue: number; social: number; curiosity: number }
export type AnimalRelation = { affinity: number; lastInteraction: number }
export type AnimalState = {
  id: string
  x: number
  y: number
  zoneId: string
  domain: AnimalDomain
  action: AnimalAction
  emotion: AnimalEmotion
  heading: 1 | -1
  phase: number
  time: number
  gaitPhase: number
  partnerId?: string
  relationships: Record<string, AnimalRelation>
  needs: AnimalNeeds
}
type Live = {
  spec: AnimalSpec
  state: AnimalState
  target: Point | null
  waypoints: Point[]
  afterMove: AnimalAction
  arrivalHeading?: 1 | -1
  elapsed: number
  duration: number
  cooldown: number
  feedingRetry: number
  petRoutine?: PetRoutine
  petRemaining?: AnimalAction[]
}
type Pair = { a: Live; b: Live; stage: number; time: number; targets: [Point, Point] }
const clamp = (v: number) => Math.max(0, Math.min(1, v))
export function pointInAnimalPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j]
    const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)
    if (
      Math.abs(cross) < 1e-7 &&
      p.x >= Math.min(a.x, b.x) - 1e-7 &&
      p.x <= Math.max(a.x, b.x) + 1e-7 &&
      p.y >= Math.min(a.y, b.y) - 1e-7 &&
      p.y <= Math.max(a.y, b.y) + 1e-7
    )
      return true
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside
  }
  return inside
}
export function animalFitsZone(spec: AnimalSpec, zone: NavZone, p: Point): boolean {
  const traits = ANIMAL_SPECIES[spec.species],
    shape = traits.footprint,
    w =
      (zone.boundsPolicy === 'body' ? traits.visualEnvelope.halfWidth : shape.halfWidth) *
      spec.scale,
    above =
      (zone.boundsPolicy === 'body' ? traits.visualEnvelope.above : shape.halfDepth) * spec.scale,
    below =
      (zone.boundsPolicy === 'body' ? traits.visualEnvelope.below : shape.halfDepth) * spec.scale
  // Contact surfaces use shallow footprints; air/submerged bodies use the full 2D envelope.
  const points = [
    p,
    { x: p.x - w, y: p.y - above },
    { x: p.x + w, y: p.y - above },
    { x: p.x + w, y: p.y + below },
    { x: p.x - w, y: p.y + below },
  ]
  return (
    points.every(
      (q) =>
        pointInAnimalPolygon(q, zone.polygon) &&
        !zone.holes.some((h) => pointInAnimalPolygon(q, h)),
    ) &&
    !zone.holes.some((h) =>
      h.some((q) => q.x >= p.x - w && q.x <= p.x + w && q.y >= p.y - above && q.y <= p.y + below),
    )
  )
}
export function animalSegmentFits(spec: AnimalSpec, zone: NavZone, a: Point, b: Point): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3))
  for (let i = 0; i <= steps; i++)
    if (
      !animalFitsZone(spec, zone, {
        x: a.x + ((b.x - a.x) * i) / steps,
        y: a.y + ((b.y - a.y) * i) / steps,
      })
    )
      return false
  return true
}
export class AnimalLifeSimulation {
  private live: Live[]
  private pairs: Pair[] = []
  private accumulator = 0
  private seed: number
  private paused = false
  private disposed = false
  private zones: Map<string, NavZone>
  readonly plan: AnimalHabitat
  constructor(plan: AnimalHabitat, seed = 1) {
    this.plan = plan
    this.seed = seed >>> 0 || 1
    this.zones = new Map(plan.zones.map((z) => [z.id, z]))
    this.live = plan.actors.map((spec) => ({
      spec,
      state: {
        id: spec.id,
        x: spec.home.x,
        y: spec.home.y,
        zoneId: spec.zoneId,
        domain: this.zones.get(spec.zoneId)!.domain,
        action:
          this.zones.get(spec.zoneId)!.domain === 'air' &&
          this.zones.get(spec.zoneId)!.support !== 'thread'
            ? 'fly'
            : 'rest',
        emotion: 'calm',
        heading: 1,
        phase: 0,
        time: 0,
        gaitPhase: 0,
        relationships: {},
        needs: { hunger: 0.2 + this.random() * 0.15, fatigue: 0.2, social: 0.5, curiosity: 0.2 },
      },
      target: null,
      waypoints: [],
      afterMove: 'observe',
      elapsed: 0,
      duration: 6 + this.random() * 12,
      cooldown: 15 + this.random() * 10,
      feedingRetry: 0,
    }))
    for (const actor of this.live) {
      if (actor.spec.species === 'cat' || actor.spec.species === 'dog') {
        const routine = createPetRoutine(actor.spec.id, seed, actor.spec.species)
        actor.petRoutine = routine
        actor.petRemaining = routine.actions.filter((_, index) => index !== routine.openingIndex)
        actor.state.action = routine.actions[routine.openingIndex]
        actor.state.emotion =
          actor.state.action === 'sleep'
            ? 'sleepy'
            : actor.state.action === 'play' || actor.state.action === 'sniff'
              ? 'curious'
              : 'calm'
        actor.duration = routine.openingDuration
      }
      if (!animalFitsZone(actor.spec, this.zones.get(actor.state.zoneId)!, actor.state))
        throw new RangeError(`Animal home leaves its supported zone: ${actor.spec.id}`)
    }
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0
    return this.seed / 4294967296
  }
  setPaused(value: boolean) {
    this.paused = value
  }
  snapshot(): AnimalState[] {
    return this.live.map((a) => ({
      ...a.state,
      needs: { ...a.state.needs },
      relationships: Object.fromEntries(
        Object.entries(a.state.relationships).map(([id, relation]) => [id, { ...relation }]),
      ),
    }))
  }
  dispose() {
    this.disposed = true
    this.pairs = []
    this.live.forEach((a) => (a.target = null))
  }
  interact(id: string) {
    if (this.disposed || this.paused) return
    const a = this.live.find((a) => a.spec.id === id)
    if (!a || a.state.partnerId) return
    this.action(a, 'observe', 2.5, a.state.emotion === 'curious' ? 'startled' : 'curious')
    a.state.needs.curiosity = clamp(a.state.needs.curiosity + 0.15)
  }
  step(dt: number) {
    if (this.paused || this.disposed) return
    if (!Number.isFinite(dt) || dt < 0 || dt > 3600)
      throw new RangeError('Animal step must be finite 0..3600 seconds')
    this.accumulator += dt
    while (this.accumulator + 1e-9 >= 0.1) {
      this.tick(0.1)
      this.accumulator -= 0.1
    }
  }
  private action(a: Live, action: AnimalAction, duration: number, emotion: AnimalEmotion = 'calm') {
    if (this.collides(a, a.state, a.state.heading, action)) {
      action = !this.collides(a, a.state, a.state.heading, 'observe') ? 'observe' : a.state.action
    }
    a.state.action = action
    a.state.emotion = emotion
    a.elapsed = 0
    a.duration = duration
    a.state.phase = 0
    a.target = null
    a.waypoints = []
    a.arrivalHeading = undefined
  }
  private collides(a: Live, p: Point, heading = a.state.heading, action = a.state.action) {
    const t = ANIMAL_SPECIES[a.spec.species].footprint
    return this.live.some((b) => {
      if (a === b) return false
      const zone = this.zones.get(a.state.zoneId)!,
        otherZone = this.zones.get(b.state.zoneId)!
      if (
        a.state.zoneId !== b.state.zoneId &&
        !(
          zone.domain === 'air' &&
          otherZone.domain === 'air' &&
          zone.habitat === otherZone.habitat &&
          zone.layer === otherZone.layer
        )
      )
        return false
      if (zone.boundsPolicy === 'body') {
        const aa = ANIMAL_SPECIES[a.spec.species].visualEnvelope,
          bb = ANIMAL_SPECIES[b.spec.species].visualEnvelope
        return (
          Math.abs(p.x - b.state.x) < aa.halfWidth * a.spec.scale + bb.halfWidth * b.spec.scale &&
          p.y - aa.above * a.spec.scale < b.state.y + bb.below * b.spec.scale &&
          p.y + aa.below * a.spec.scale > b.state.y - bb.above * b.spec.scale
        )
      }
      // Feet define support; opaque heads/torso define collision. Decorative tails are excluded.
      const table: Partial<Record<AnimalSpec['species'], number[][]>> = {
        cat: [
          [43, 46],
          [39, 50],
          [39, 58],
          [39, 55],
          [39, 52],
          [43, 50],
        ],
        dog: [
          [49, 61],
          [45, 65],
          [45, 57],
          [45, 61],
          [45, 67],
          [50, 65],
        ],
        rabbit: [
          [39, 40],
          [35, 42],
          [35, 62],
          [35, 53],
          [35, 44],
          [39, 42],
        ],
        squirrel: [
          [31, 37],
          [27, 39],
          [27, 40],
          [27, 38],
          [27, 41],
          [30, 39],
        ],
        duck: [
          [31, 51],
          [31, 56],
          [31, 52],
          [31, 56],
          [31, 58],
          [31, 56],
        ],
      }
      if (table[a.spec.species] && table[b.spec.species]) {
        const interval = (actor: Live, point: Point, facing: number, action: AnimalAction) => {
          const index =
            action === 'stretch'
              ? 5
              : ['rest', 'sleep'].includes(action)
                ? 0
                : action === 'eat'
                  ? 2
                  : action === 'groom'
                    ? 3
                    : ['sniff', 'greet', 'nuzzle', 'headbump'].includes(action)
                      ? 4
                      : 1
          const [back, front] = table[actor.spec.species]![index].map((v) => v * actor.spec.scale)
          return facing > 0 ? [point.x - back, point.x + front] : [point.x - front, point.x + back]
        }
        const aa = interval(a, p, heading, action),
          bb = interval(b, b.state, b.state.heading, b.state.action)
        if (
          Math.abs(p.y - b.state.y) < 60 * Math.max(a.spec.scale, b.spec.scale) &&
          aa[0] < bb[1] - 1e-6 &&
          bb[0] < aa[1] - 1e-6
        )
          return true
      }
      const other = ANIMAL_SPECIES[b.spec.species].footprint,
        w = t.halfWidth * a.spec.scale + other.halfWidth * b.spec.scale,
        d = t.halfDepth * a.spec.scale + other.halfDepth * b.spec.scale
      return ((p.x - b.state.x) / w) ** 2 + ((p.y - b.state.y) / d) ** 2 < 1 - 1e-6
    })
  }
  private contactPoint(zone: NavZone, point: Point): Point | null {
    if (zone.support !== 'branch' || zone.route.length < 2) return point
    const route = [...zone.route].sort((a, b) => a.x - b.x)
    if (point.x < route[0].x || point.x > route.at(-1)!.x) return null
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i]
      if (point.x <= b.x)
        return { x: point.x, y: a.y + ((b.y - a.y) * (point.x - a.x)) / (b.x - a.x || 1) }
    }
    return point
  }
  private move(a: Live, target: Point, dt: number) {
    const distance = Math.hypot(target.x - a.state.x, target.y - a.state.y)
    if (distance < 0.3) return true
    const speed = ANIMAL_SPECIES[a.spec.species].speed,
      step = Math.min(distance, speed * dt),
      p = {
        x: a.state.x + ((target.x - a.state.x) * step) / distance,
        y: a.state.y + ((target.y - a.state.y) * step) / distance,
      }
    const zone = this.zones.get(a.state.zoneId)!
    const contact = this.contactPoint(zone, p)
    if (!contact) return false
    p.y = contact.y
    const heading = p.x < a.state.x ? -1 : p.x > a.state.x ? 1 : a.state.heading
    if (this.collides(a, p, heading)) {
      if (a.state.needs.hunger > 0.48 && zone.boundsPolicy === 'body') {
        const own = ANIMAL_SPECIES[a.spec.species].visualEnvelope
        const blocking = this.live.find(
          (b) =>
            b !== a &&
            b.state.zoneId === a.state.zoneId &&
            !b.target &&
            !b.state.partnerId &&
            b.state.action !== 'eat' &&
            Math.abs(p.x - b.state.x) <
              own.halfWidth * a.spec.scale +
                ANIMAL_SPECIES[b.spec.species].visualEnvelope.halfWidth * b.spec.scale &&
            p.y - own.above * a.spec.scale <
              b.state.y + ANIMAL_SPECIES[b.spec.species].visualEnvelope.below * b.spec.scale &&
            p.y + own.below * a.spec.scale >
              b.state.y - ANIMAL_SPECIES[b.spec.species].visualEnvelope.above * b.spec.scale,
        )
        if (blocking) {
          const escape = zone.route.find(
            (point) =>
              Math.hypot(point.x - blocking.state.x, point.y - blocking.state.y) > 5 &&
              this.clearPath(blocking, blocking.state, point),
          )
          if (escape && this.go(blocking, escape, 'observe')) blocking.state.emotion = 'curious'
        }
      }
      if (!a.state.partnerId) {
        if (a.afterMove === 'eat') a.feedingRetry = 12 + this.random() * 12
        this.action(a, 'yield', 1.2 + this.random() * 1.3, 'startled')
        a.cooldown = Math.max(a.cooldown, 3)
      }
      return false
    }
    if (animalSegmentFits(a.spec, zone, a.state, p)) {
      a.state.heading = heading
      a.state.gaitPhase =
        (a.state.gaitPhase +
          Math.hypot(p.x - a.state.x, p.y - a.state.y) /
            Math.max(8, ANIMAL_SPECIES[a.spec.species].footprint.halfWidth * a.spec.scale)) %
        1
      a.state.x = p.x
      a.state.y = p.y
      return step === distance
    }
    return false
  }
  private locomotion(a: Live): AnimalAction {
    const domain = a.state.domain
    return domain === 'air'
      ? a.spec.species === 'spider'
        ? 'walk'
        : 'fly'
      : domain === 'water'
        ? 'swim'
        : ['rabbit', 'squirrel', 'songbird', 'owl', 'gull'].includes(a.spec.species)
          ? 'hop'
          : 'walk'
  }
  private clearPath(a: Live, from: Point, to: Point, action: AnimalAction = a.state.action) {
    const zone = this.zones.get(a.state.zoneId)!
    if (!animalSegmentFits(a.spec, zone, from, to)) return false
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 3))
    for (let i = 1; i <= steps; i++)
      if (
        this.collides(
          a,
          {
            x: from.x + ((to.x - from.x) * i) / steps,
            y: from.y + ((to.y - from.y) * i) / steps,
          },
          to.x < from.x ? -1 : to.x > from.x ? 1 : a.state.heading,
          action,
        )
      )
        return false
    return true
  }
  private routeTo(a: Live, target: Point): Point[] | null {
    if (this.clearPath(a, a.state, target)) return [target]
    const zone = this.zones.get(a.state.zoneId)!,
      nodes: Point[] = [a.state, target, ...zone.route]
    const xs = zone.polygon.map((p) => p.x),
      ys = zone.polygon.map((p) => p.y)
    if (zone.boundsPolicy === 'body')
      for (let y = Math.min(...ys) + 40; y < Math.max(...ys); y += 60)
        for (let x = Math.min(...xs) + 40; x < Math.max(...xs); x += 60) {
          const p = { x, y }
          if (animalFitsZone(a.spec, zone, p) && !this.collides(a, p)) nodes.push(p)
        }
    const previous = new Map<number, number>([[0, -1]]),
      queue = [0]
    for (let q = 0; q < queue.length; q++) {
      const current = queue[q]
      for (let next = 1; next < nodes.length; next++)
        if (!previous.has(next) && this.clearPath(a, nodes[current], nodes[next])) {
          previous.set(next, current)
          if (next === 1) {
            const path: Point[] = []
            for (let n = 1; n !== 0; n = previous.get(n)!) path.unshift(nodes[n])
            return path
          }
          queue.push(next)
        }
    }
    return null
  }
  private go(a: Live, p: Point, after: AnimalAction, arrivalHeading?: 1 | -1) {
    const zone = this.zones.get(a.state.zoneId)!
    const contact = this.contactPoint(zone, p)
    if (!contact) return false
    p = contact
    if (!animalSegmentFits(a.spec, zone, a.state, p)) return false
    // A pet already at its meal station eats in place; do not announce a
    // walking pose when the entire trip would have zero displacement.
    if (a.petRoutine && Math.hypot(p.x - a.state.x, p.y - a.state.y) < 0.3) {
      if (after !== 'eat' || this.collides(a, a.state, arrivalHeading ?? a.state.heading, 'eat'))
        return false
      if (arrivalHeading) a.state.heading = arrivalHeading
      this.action(a, 'eat', 7, 'content')
      return true
    }
    let waypoints: Point[] = []
    if (after === 'eat' && zone.boundsPolicy === 'body') {
      const path = this.routeTo(a, p)
      if (!path) return false
      p = path[0]
      waypoints = path.slice(1)
    }
    const domain = zone.domain
    this.action(
      a,
      domain === 'air'
        ? a.spec.species === 'spider'
          ? 'walk'
          : 'fly'
        : domain === 'water'
          ? 'swim'
          : ['rabbit', 'squirrel', 'songbird', 'owl', 'gull'].includes(a.spec.species)
            ? 'hop'
            : 'walk',
      Math.max(
        12,
        Math.hypot(p.x - a.state.x, p.y - a.state.y) /
          Math.max(0.1, ANIMAL_SPECIES[a.spec.species].speed) +
          4,
      ),
      'curious',
    )
    if (a.state.action !== this.locomotion(a)) return false
    a.target = p
    a.waypoints = waypoints
    a.afterMove = after
    return true
  }
  private startPair(a: Live, b: Live) {
    const zone = this.zones.get(a.state.zoneId)!,
      wa =
        Math.max(ANIMAL_SPECIES[a.spec.species].socialReach, a.spec.species === 'rabbit' ? 44 : 0) *
        a.spec.scale,
      wb =
        Math.max(ANIMAL_SPECIES[b.spec.species].socialReach, b.spec.species === 'rabbit' ? 44 : 0) *
        b.spec.scale
    const direction = a.state.x <= b.state.x ? 1 : -1,
      mid = (a.state.x + b.state.x) / 2,
      y = (a.state.y + b.state.y) / 2
    let targets: [Point, Point] = [
      { x: mid - direction * (wa + 1), y },
      { x: mid + direction * (wb + 1), y },
    ]
    if (zone.support === 'branch') {
      const xs = zone.route.map((p) => p.x)
      const shift =
        Math.max(0, Math.min(...xs) - Math.min(...targets.map((p) => p.x))) -
        Math.max(0, Math.max(...targets.map((p) => p.x)) - Math.max(...xs))
      const projected = targets.map((p) => this.contactPoint(zone, { x: p.x + shift, y: p.y }))
      if (!projected[0] || !projected[1]) return false
      targets = projected as [Point, Point]
    }
    if (
      !animalSegmentFits(a.spec, zone, a.state, targets[0]) ||
      !animalSegmentFits(b.spec, zone, b.state, targets[1])
    )
      return false
    a.state.partnerId = b.spec.id
    b.state.partnerId = a.spec.id
    this.action(a, this.locomotion(a), 30, 'curious')
    this.action(b, this.locomotion(b), 30, 'curious')
    if (a.state.action !== this.locomotion(a) || b.state.action !== this.locomotion(b)) {
      a.state.partnerId = undefined
      b.state.partnerId = undefined
      this.action(a, 'observe', 3)
      this.action(b, 'observe', 3)
      return false
    }
    this.pairs.push({ a, b, stage: 0, time: 0, targets })
    return true
  }
  private tick(dt: number) {
    for (const a of this.live) {
      const t = ANIMAL_SPECIES[a.spec.species]
      a.state.time += dt
      a.cooldown = Math.max(0, a.cooldown - dt)
      a.feedingRetry = Math.max(0, a.feedingRetry - dt)
      for (const need of Object.keys(a.state.needs) as (keyof AnimalNeeds)[])
        a.state.needs[need] = clamp(a.state.needs[need] + t.needDrift[need] * dt)
      if (a.state.partnerId) continue
      a.elapsed += dt
      a.state.phase = Math.min(1, a.elapsed / a.duration)
      if (a.target) {
        if (this.move(a, a.target, dt)) {
          if (a.waypoints.length) {
            a.target = a.waypoints.shift()!
            a.elapsed = 0
            a.duration = Math.max(
              12,
              Math.hypot(a.target.x - a.state.x, a.target.y - a.state.y) /
                Math.max(0.1, ANIMAL_SPECIES[a.spec.species].speed) +
                4,
            )
            continue
          }
          if (a.arrivalHeading && this.collides(a, a.state, a.arrivalHeading, a.afterMove)) {
            a.feedingRetry = 12
            this.action(a, 'yield', 2, 'curious')
            continue
          }
          if (a.arrivalHeading) a.state.heading = a.arrivalHeading
          a.arrivalHeading = undefined
          this.action(
            a,
            a.afterMove,
            a.afterMove === 'eat'
              ? 7
              : a.petRoutine
                ? petActionDuration(a.afterMove, this.random())
                : 3,
            'content',
          )
        } else if (a.elapsed > a.duration) {
          if (a.afterMove === 'eat') a.feedingRetry = 20
          this.action(a, 'yield', 3)
        }
        continue
      }
      if (a.state.action === 'eat') a.state.needs.hunger = clamp(a.state.needs.hunger - dt * 0.09)
      if (a.state.action === 'sleep' || a.state.action === 'rest')
        a.state.needs.fatigue = clamp(a.state.needs.fatigue - dt * 0.025)
      if (a.elapsed < a.duration) continue
      const partner = this.live.find(
        (b) =>
          b !== a &&
          !b.state.partnerId &&
          !b.cooldown &&
          b.state.zoneId === a.state.zoneId &&
          a.state.needs.social > 0.52 &&
          a.state.needs.hunger < 0.48 &&
          b.state.needs.hunger < 0.48 &&
          t.socialWith.includes(b.spec.species) &&
          ANIMAL_SPECIES[b.spec.species].socialWith.includes(a.spec.species),
      )
      if (partner && !a.cooldown && this.startPair(a, partner)) continue
      const foods = this.plan.resources
        .filter(
          (r) =>
            r.zoneId === a.state.zoneId &&
            r.kind === 'food' &&
            (!r.consumerId || r.consumerId === a.spec.id),
        )
        .sort(
          (r, s) =>
            Math.hypot(
              (r.approach ?? r.position).x - a.state.x,
              (r.approach ?? r.position).y - a.state.y,
            ) -
            Math.hypot(
              (s.approach ?? s.position).x - a.state.x,
              (s.approach ?? s.position).y - a.state.y,
            ),
        )
      const food = foods.find(
        (r) =>
          this.zones.get(a.state.zoneId)!.boundsPolicy !== 'body' ||
          this.routeTo(a, r.approach ?? r.position) !== null,
      )
      if (
        food &&
        !a.feedingRetry &&
        a.state.needs.hunger > 0.48 &&
        t.actions.includes('eat') &&
        this.go(a, food.approach || food.position, 'eat', food.heading)
      ) {
        if (a.target) a.arrivalHeading = food.heading
        continue
      }
      if (a.petRoutine) {
        const routine = a.petRoutine
        const next = nextPetAction(
          routine,
          a.petRemaining ?? [],
          a.state.action,
          a.state.needs,
          this.random(),
        )
        a.petRemaining = next.remaining
        const choice = next.action
        const zone = this.zones.get(a.state.zoneId)!
        // A shared route endpoint can be occupied while a useful short prefix
        // remains free. Walk only along the existing segment, never extrapolate
        // beyond its support, and validate the wider walking pose before turning.
        const destinations = zone.route.flatMap((end) => {
          const dx = end.x - a.state.x,
            dy = end.y - a.state.y
          const distance = Math.hypot(dx, dy)
          const limit = Math.min(18, distance)
          for (let step = Math.floor(limit / 2) * 2; step >= 2; step -= 2) {
            const point = {
              x: a.state.x + (dx * step) / distance,
              y: a.state.y + (dy * step) / distance,
            }
            if (this.clearPath(a, a.state, point, this.locomotion(a))) return [point]
          }
          return []
        })
        if (destinations.length && this.random() < routine.walkChance) {
          const point = destinations[Math.floor(this.random() * destinations.length)]
          if (this.go(a, point, choice)) continue
        }
        this.action(
          a,
          choice,
          petActionDuration(choice, this.random()),
          choice === 'sleep'
            ? 'sleepy'
            : choice === 'play' || choice === 'sniff'
              ? 'curious'
              : 'calm',
        )
        a.state.needs.curiosity *= 0.65
        continue
      }
      const unsupportedAir =
        a.state.domain === 'air' && this.zones.get(a.state.zoneId)!.support !== 'thread'
      if (!unsupportedAir && a.state.needs.fatigue > 0.62 && t.actions.includes('sleep')) {
        this.action(a, 'sleep', 12 + this.random() * 16, 'sleepy')
        continue
      }
      const zone = this.zones.get(a.state.zoneId)!
      const point = zone.route[Math.floor(this.random() * zone.route.length)]
      if (this.random() < 0.38 && t.speed > 0 && this.go(a, point, 'observe')) continue
      const choices: AnimalAction[] = ['rest', 'observe', 'groom', 'stretch', 'sleep'].filter(
        (action) =>
          t.actions.includes(action as AnimalAction) &&
          (!unsupportedAir || ['rest', 'observe'].includes(action)),
      ) as AnimalAction[]
      const choice = choices[Math.floor(this.random() * choices.length)]
      this.action(
        a,
        choice,
        5 + this.random() * 12,
        choice === 'sleep' ? 'sleepy' : this.random() < 0.3 ? 'curious' : 'calm',
      )
      a.state.needs.curiosity *= 0.65
    }
    for (const pair of [...this.pairs]) {
      const { a, b } = pair
      pair.time += dt
      if (pair.stage === 0) {
        const thirdBlocks = [a, b].some((actor, index) => {
          const goal = pair.targets[index],
            distance = Math.hypot(goal.x - actor.state.x, goal.y - actor.state.y)
          const fraction = distance
            ? Math.min(1, (ANIMAL_SPECIES[actor.spec.species].speed * dt) / distance)
            : 0
          const p = {
            x: actor.state.x + (goal.x - actor.state.x) * fraction,
            y: actor.state.y + (goal.y - actor.state.y) * fraction,
          }
          return this.live.some(
            (other) =>
              other !== a &&
              other !== b &&
              other.state.zoneId === actor.state.zoneId &&
              ((p.x - other.state.x) /
                (ANIMAL_SPECIES[actor.spec.species].footprint.halfWidth * actor.spec.scale +
                  ANIMAL_SPECIES[other.spec.species].footprint.halfWidth * other.spec.scale)) **
                2 +
                ((p.y - other.state.y) /
                  (ANIMAL_SPECIES[actor.spec.species].footprint.halfDepth * actor.spec.scale +
                    ANIMAL_SPECIES[other.spec.species].footprint.halfDepth * other.spec.scale)) **
                  2 <
                1,
          )
        })
        if (thirdBlocks) {
          this.endPair(pair)
          this.action(a, 'yield', 1.5, 'startled')
          this.action(b, 'yield', 1.5, 'startled')
          continue
        }
        const arrivedA = this.move(a, pair.targets[0], dt),
          arrivedB = this.move(b, pair.targets[1], dt)
        a.state.phase = b.state.phase = Math.min(1, pair.time / 6)
        if (arrivedA && arrivedB) {
          pair.stage = 1
          pair.time = 0
          this.action(
            a,
            ['fish', 'firefly'].includes(a.spec.species) ? 'greet' : 'sniff',
            1.5,
            'curious',
          )
          this.action(
            b,
            ['fish', 'firefly'].includes(b.spec.species) ? 'greet' : 'sniff',
            1.5,
            'curious',
          )
        } else if (pair.time > 25) this.endPair(pair)
        continue
      }
      const facing = a.state.x < b.state.x ? 1 : -1
      if (this.collides(a, a.state, facing) || this.collides(b, b.state, -facing as 1 | -1)) {
        this.endPair(pair)
        continue
      }
      a.state.heading = facing
      b.state.heading = -facing as 1 | -1
      a.state.phase = b.state.phase = Math.min(1, pair.time / 1.8)
      if (pair.time >= 1.8) {
        pair.time = 0
        pair.stage++
        if (pair.stage >= 4) {
          this.endPair(pair)
          continue
        }
        const physical = ['cat', 'dog', 'rabbit', 'squirrel', 'duck'].includes(a.spec.species)
        const action: AnimalAction = physical ? (pair.stage === 2 ? 'nuzzle' : 'headbump') : 'greet'
        this.action(a, action, 1.8, 'content')
        this.action(b, action, 1.8, 'content')
      }
    }
  }
  private endPair(pair: Pair) {
    const completed = pair.stage >= 4
    for (const a of [pair.a, pair.b]) {
      const partner = a === pair.a ? pair.b : pair.a
      if (completed)
        a.state.relationships[partner.spec.id] = {
          affinity: clamp((a.state.relationships[partner.spec.id]?.affinity || 0) + 0.15),
          lastInteraction: a.state.time,
        }
      a.state.partnerId = undefined
      if (completed) a.state.needs.social = 0
      a.cooldown = completed ? 45 + this.random() * 35 : 10 + this.random() * 10
      this.action(a, 'rest', 5, 'content')
    }
    this.pairs = this.pairs.filter((p) => p !== pair)
  }
}
