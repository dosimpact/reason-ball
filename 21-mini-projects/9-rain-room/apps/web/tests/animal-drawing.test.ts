import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { Graphics } from 'pixi.js'
import {
  ANIMAL_SPECIES,
  ANIMAL_FEEDING_OFFSET as modelFood,
} from '../src/pages/focus/model/animalSpecies.ts'
import { ANIMAL_HABITATS, getAnimalHabitat } from '../src/pages/focus/model/animalHabitats.ts'
import {
  animalRig,
  animalPartSvg,
  animalPartPose,
  animalPoseSvg,
  animalPoseBounds,
  animalResourceSvg,
  animalTetherLine,
  DRAWN_ANIMAL_SPECIES,
  ANIMAL_FEEDING_OFFSET,
} from '../src/pages/focus/lib/animalDrawing.ts'
const window = new Window()
const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: window.document,
  writable: true,
})
const specimens = new Map(
  Object.values(ANIMAL_HABITATS)
    .flatMap((p) => p.actors)
    .map((a) => [a.species, a]),
)
const state = (spec: any, action = 'observe', extra = {}) => ({
  id: spec.id,
  x: 400,
  y: 600,
  action,
  heading: 1,
  phase: 0.5,
  time: 1.2,
  gaitPhase: 0.25,
  ...extra,
})

test('every actually inventoried species has explicit reusable native geometry with nonnegative baked path points', () => {
  assert.deepEqual([...DRAWN_ANIMAL_SPECIES].sort(), Object.keys(ANIMAL_SPECIES).sort())
  assert.equal(specimens.size, 22)
  for (const spec of specimens.values()) {
    const rig = animalRig(spec)
    assert.ok(rig.length >= 4, spec.species)
    assert.ok(
      animalRig({ ...spec, id: 'another-id', scale: spec.scale * 0.8 }) === rig,
      'same colors/species reuse cached rig',
    )
    for (const part of rig) {
      const svg = animalPartSvg(part)
      assert.ok(
        !/transform=|<image|<filter|<g\b/.test(svg),
        'native geometry never relies on group transforms/raster/filters',
      )
      const el = window.document.createElement('div')
      el.innerHTML = svg
      for (const path of el.querySelectorAll('path'))
        for (const value of path.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g) ?? [])
          assert.ok(Number(value) >= 0, `${spec.species}/${part.name}: baked point`)
      const graphic = new Graphics().svg(svg)
      try {
        const b = graphic.getLocalBounds()
        assert.ok(Number.isFinite(b.minX) && Number.isFinite(b.maxY))
        assert.ok(
          b.minX >= 0 && b.minY >= 0,
          `${spec.species}/${part.name}: native bounds ${b.minX},${b.minY}`,
        )
        assert.ok(b.maxX > b.minX && b.maxY > b.minY)
      } finally {
        graphic.destroy({ context: true })
      }
    }
  }
  assert.throws(
    () =>
      animalRig({ id: 'bad', species: 'unknown', coat: '#123456', scale: 1, home: { x: 0, y: 0 } }),
    RangeError,
  )
})

test('walking uses standing bodies and distance-driven legs; sleeping replaces bodies and closes eyes', () => {
  for (const species of ['cat', 'dog', 'deer', 'fox', 'rabbit', 'squirrel', 'camel']) {
    const spec = specimens.get(species)!,
      rig = animalRig(spec),
      walk = state(spec, 'walk'),
      sleep = state(spec, 'sleep')
    assert.equal(animalPartPose(rig.find((p) => p.name === 'sleep-body')!, walk).alpha, 0)
    assert.equal(animalPartPose(rig.find((p) => p.name === 'sleep-body')!, sleep).alpha, 1)
    assert.equal(animalPartPose(rig.find((p) => p.name === 'body')!, sleep).alpha, 0)
    const leg = rig.find((p) => p.motion === 'leg')!
    assert.equal(animalPartPose(leg, sleep).alpha, 0)
    assert.notEqual(
      animalPartPose(leg, { ...walk, gaitPhase: 0 }).rotation,
      animalPartPose(leg, { ...walk, gaitPhase: 0.25 }).rotation,
    )
    assert.equal(
      animalPartPose(leg, { ...walk, time: 9 }).rotation,
      animalPartPose(leg, { ...walk, time: 10 }).rotation,
      'stationary gaitPhase does not skate feet with clock',
    )
    assert.equal(animalPartPose(rig.find((p) => p.name === 'eye-open')!, sleep).alpha, 0)
    assert.equal(animalPartPose(rig.find((p) => p.name === 'eye-closed')!, sleep).alpha, 1)
  }
  const spec = specimens.get('cat')!,
    body = animalRig(spec).find((p) => p.name === 'sleep-body')!
  assert.notEqual(
    animalPartPose(body, state(spec, 'sleep', { phase: 0, time: 0 })).scaleY,
    animalPartPose(body, state(spec, 'sleep', { phase: 0, time: 1 })).scaleY,
    'breathing uses seconds even with held action progress',
  )
})

test('medium-aware water and air poses cannot show standing feet or folded unsupported wings', () => {
  for (const species of ['duck', 'gull'])
    for (const action of ['rest', 'sleep', 'observe', 'eat']) {
      const spec = specimens.get(species)!,
        s = state(spec, action, { domain: 'water' })
      for (const part of animalRig(spec).filter((p) => p.motion === 'leg'))
        assert.equal(animalPartPose(part, s).alpha, 0)
      assert.ok(animalPartPose(animalRig(spec).find((p) => p.motion === 'wake')!, s).alpha > 0)
    }
  for (const species of ['gull', 'bat']) {
    const spec = specimens.get(species)!,
      s = state(spec, 'rest', { domain: 'air' })
    for (const part of animalRig(spec).filter(
      (p) => p.motion === 'folded-wing' || p.motion === 'leg',
    ))
      assert.equal(animalPartPose(part, s).alpha, 0)
    for (const part of animalRig(spec).filter((p) => p.motion === 'flight-wing'))
      assert.equal(animalPartPose(part, s).alpha, 1)
  }
})

test('native positive-coordinate offset is compensated about the anatomical joint and all actual poses stay finite', () => {
  for (const spec of specimens.values())
    for (const action of ANIMAL_SPECIES[spec.species].actions)
      for (const heading of [-1, 1]) {
        const s = state(spec, action, { heading })
        const bounds = animalPoseBounds(spec, s)
        assert.ok(Object.values(bounds).every(Number.isFinite), spec.species)
        assert.ok(bounds.width > 0 && bounds.height > 0)
        assert.ok(!/NaN|Infinity|transform=/.test(animalPoseSvg(spec, s)))
      }
  const spec = specimens.get('cat')!
  for (const part of animalRig(spec)) {
    const p = animalPartPose(part, state(spec, 'walk', { time: 0, phase: 0, gaitPhase: 0 })),
      o = part.svgOffset!
    if (p.alpha === 0) continue
    assert.ok(Math.abs(p.x + o.x - part.anchor.x) < 1e-8)
    assert.ok(Math.abs(p.y + o.y - part.anchor.y) < 1e-8)
  }
  const dragon = getAnimalHabitat('premium-dragon-study').actors.find(
    (a) => a.species === 'dragon',
  )!
  for (let time = 0; time < 30; time += 0.1) {
    const b = animalPoseBounds(dragon, { ...state(dragon, 'sleep', { time }), ...dragon.home })
    assert.ok(b.width >= 400 && b.height >= 200, 'giant hero retains bulk')
    assert.ok(
      b.x >= 0 && b.y >= 0 && b.x + b.width <= 800 && b.y + b.height <= 820,
      'full hero stays in original core',
    )
  }
})

test('food offsets match the model and resource/tether geometry is shared world-space, without duplicate rest beds', () => {
  for (const species of Object.keys(ANIMAL_SPECIES))
    assert.deepEqual(ANIMAL_FEEDING_OFFSET[species], modelFood[species], species)
  const empty = animalResourceSvg(
    { kind: 'rest', position: { x: 400, y: 600 } },
    { domain: 'ground' },
  )
  assert.equal(empty.includes('<path'), false)
  for (const domain of ['ground', 'perch', 'water']) {
    const svg = animalResourceSvg({ kind: 'food', position: { x: 400, y: 600 } }, { domain })
    assert.ok(svg.includes('<path') && !svg.includes('transform='))
  }
  const spider = specimens.get('spider')!,
    s = state(spider, 'rest', { x: 680, y: 280 }),
    anchor = { x: 680, y: 205 }
  const line = animalTetherLine(spider, s, anchor)!
  assert.equal(line.x1, anchor.x)
  assert.equal(line.y1, anchor.y)
  assert.equal(line.x2, s.x)
  assert.equal(line.y2, s.y - 20 * spider.scale)
  assert.ok(animalPoseSvg({ ...spider, tetherAnchor: anchor }, s).includes('205'))
})

test.after(async () => {
  await window.happyDOM.abort()
  if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument)
  else Reflect.deleteProperty(globalThis, 'document')
})

test('all 22 species change actual non-eye part geometry over time while the root remains fixed', () => {
  for (const spec of specimens.values()) {
    const plan = Object.values(ANIMAL_HABITATS).find((p) =>
        p.actors.some((a) => a.id === spec.id),
      )!,
      zone = plan.zones.find((z) => z.id === spec.zoneId)!
    const action =
      ANIMAL_SPECIES[spec.species].actions.find((a) =>
        ['walk', 'hop', 'fly', 'swim'].includes(a),
      ) ?? 'rest'
    const geometry = [0, 0.2, 0.5, 1, 1.5].map((time) =>
      JSON.stringify(
        animalRig(spec)
          .filter((part) => !['eye-open', 'eye-closed'].includes(part.motion ?? ''))
          .map((part) =>
            animalPartPose(
              part,
              state(spec, action, { time, gaitPhase: (time * 1.7) % 1, domain: zone.domain }),
            ),
          ),
      ),
    )
    assert.ok(
      new Set(geometry).size > 1,
      `${spec.species}: living motion changes parts, not only root translation`,
    )
  }
})

test('supported grooming raises a connected front paw or turns the head toward a folded wing, never in air or water', () => {
  for (const species of ['cat', 'dog', 'fox', 'rabbit', 'squirrel', 'owl', 'songbird']) {
    const spec = specimens.get(species)!,
      rig = animalRig(spec)
    const head = rig.find((p) => p.motion === 'head')!
    const domain = ['owl', 'songbird'].includes(species) ? 'perch' : 'ground'
    const idle = animalPartPose(head, state(spec, 'observe', { domain }))
    const groom = animalPartPose(head, state(spec, 'groom', { domain }))
    assert.notEqual(groom.rotation, idle.rotation, species)
    for (const eye of rig.filter((p) => ['eye-open', 'eye-closed'].includes(p.motion ?? '')))
      assert.equal(animalPartPose(eye, state(spec, 'groom', { domain })).rotation, groom.rotation)
    if (species === 'dog') {
      const scratch = rig.find((p) => p.name === 'scratch-leg')!
      assert.equal(animalPartPose(scratch, state(spec, 'groom', { domain })).alpha, 1)
      assert.equal(
        animalPartPose(rig.find((p) => p.name === 'sit-body')!, state(spec, 'groom', { domain }))
          .alpha,
        1,
      )
    } else if (domain === 'ground') {
      const paw = rig.find((p) => p.name === 'leg-3')!
      assert.ok(animalPartPose(paw, state(spec, 'groom', { domain })).rotation < -1)
    }
    for (const invalidDomain of ['air', 'water'])
      assert.equal(
        animalPartPose(head, state(spec, 'groom', { domain: invalidDomain })).rotation,
        animalPartPose(head, state(spec, 'observe', { domain: invalidDomain })).rotation,
      )
  }
})

test('narrow squirrel front shoulders attach inside the body instead of reusing wide quadruped anchors', () => {
  const rig = animalRig(specimens.get('squirrel')!)
  for (const name of ['leg-2', 'leg-3']) {
    const leg = rig.find((p) => p.name === name)!
    // Body center(-5,-27), radii22/24; shoulder is10 below its center.
    const normalized = ((leg.anchor.x + 5) / 22) ** 2 + ((leg.anchor.y + 27) / 24) ** 2
    assert.ok(normalized < 1, `${name}: anatomical joint must intersect torso`)
  }
})

test('ground meal stations scale around the consumer mouth and herbivores get soft forage without a hard container', () => {
  const bounds = (svg: string) => {
    const root = window.document.createElement('div')
    root.innerHTML = svg
    const points = [...root.querySelectorAll('path')].flatMap((p) =>
      [...p.getAttribute('d')!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({
        x: Number(m[1]),
        y: Number(m[2]),
      })),
    )
    return {
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minY: Math.min(...points.map((p) => p.y)),
      maxY: Math.max(...points.map((p) => p.y)),
    }
  }
  for (const scale of [1, 0.5]) {
    const bowl = bounds(
      animalResourceSvg(
        { kind: 'food', position: { x: 400, y: 600 }, species: 'cat', scale },
        { domain: 'ground' },
      ),
    )
    assert.equal(bowl.maxX - bowl.minX, 15 * scale)
    assert.equal(bowl.maxY, 600 + 4.5 * scale)
    for (const species of ['rabbit', 'deer', 'camel', 'snail']) {
      const forage = bounds(
        animalResourceSvg(
          { kind: 'food', position: { x: 400, y: 600 }, species, scale },
          { domain: 'ground' },
        ),
      )
      assert.ok(
        forage.minY < 600 && forage.maxY <= 600 + 3 * scale,
        `${species}: low soft surface forage`,
      )
    }
  }
  for (const domain of ['perch', 'water'])
    assert.equal(
      animalResourceSvg({ kind: 'food', position: { x: 400, y: 600 }, scale: 0.5 }, { domain }),
      animalResourceSvg({ kind: 'food', position: { x: 400, y: 600 }, scale: 1 }, { domain }),
      'media-specific seeds/plankton unchanged',
    )
  for (const support of ['bench', 'chair']) {
    const resource = { kind: 'food', position: { x: 400, y: 600 }, scale: 0.5, species: 'cat' }
    assert.equal(
      animalResourceSvg(resource, { domain: 'perch', support }),
      animalResourceSvg(resource, { domain: 'ground' }),
      'finite seats use the same consumer-scaled pet bowl',
    )
  }
  assert.throws(
    () =>
      animalResourceSvg(
        { kind: 'food', position: { x: 400, y: 600 }, scale: 0 },
        { domain: 'ground' },
      ),
    RangeError,
  )
})

test('occasional supported cat yawns have sparse cadence and morph at the same sleeping head joint', () => {
  const cat = specimens.get('cat')!,
    rig = animalRig(cat),
    mouth = rig.find((p) => p.motion === 'yawn-mouth')!,
    head = rig.find((p) => p.motion === 'head')!
  const windows: number[][] = []
  let active = false,
    peakTime = 0,
    peak = 0
  for (let tick = 0; tick < 6000; tick++) {
    const time = tick / 20,
      p = animalPartPose(mouth, state(cat, 'rest', { domain: 'perch', time }))
    if (p.alpha > 0.01 && !active) windows.push([time, time])
    if (p.alpha > 0.01) windows.at(-1)![1] = time
    active = p.alpha > 0.01
    if (p.alpha > 0 && p.scaleY > peak) {
      peak = p.scaleY
      peakTime = time
    }
  }
  assert.ok(windows.length >= 3 && windows.length <= 4)
  for (const [i, [start, end]] of windows.entries()) {
    assert.ok(end - start >= 2 && end - start <= 2.6)
    if (i) assert.ok(start - windows[i - 1][0] >= 70 && start - windows[i - 1][0] <= 100)
  }
  const center = (part: typeof mouth, pose: ReturnType<typeof animalPartPose>) => {
    const o = part.svgOffset ?? { x: 0, y: 0 },
      x = (12 + o.x) * pose.scaleX,
      y = (11 + o.y) * pose.scaleY
    return {
      x: pose.x + Math.cos(pose.rotation) * x - Math.sin(pose.rotation) * y,
      y: pose.y + Math.sin(pose.rotation) * x + Math.cos(pose.rotation) * y,
    }
  }
  for (const time of [peakTime - 0.5, peakTime, peakTime + 0.5]) {
    const s = state(cat, 'sleep', { domain: 'ground', time }),
      m = animalPartPose(mouth, s),
      h = animalPartPose(head, s),
      mc = center(mouth, m),
      hc = center(head, h)
    assert.equal(m.rotation, h.rotation)
    assert.ok(Math.hypot(mc.x - hc.x, mc.y - hc.y) < 1e-8, 'mouth stays on head while opening')
  }
  for (const action of ['walk', 'eat', 'groom', 'nuzzle', 'headbump', 'observe'])
    assert.equal(
      animalPartPose(mouth, state(cat, action, { domain: 'ground', time: peakTime })).alpha,
      0,
    )
  for (const domain of ['air', 'water'])
    assert.equal(animalPartPose(mouth, state(cat, 'rest', { domain, time: peakTime })).alpha, 0)
  assert.ok(
    [...specimens.values()]
      .filter((s) => s.species !== 'cat')
      .every((s) => !animalRig(s).some((p) => p.motion === 'yawn-mouth')),
  )
})

function partPoint(
  part: ReturnType<typeof animalRig>[number],
  pose: ReturnType<typeof animalPartPose>,
  point: { x: number; y: number },
) {
  const offset = part.svgOffset ?? { x: 0, y: 0 }
  const x = (point.x + offset.x) * pose.scaleX,
    y = (point.y + offset.y) * pose.scaleY
  return {
    x: pose.x + Math.cos(pose.rotation) * x - Math.sin(pose.rotation) * y,
    y: pose.y + Math.sin(pose.rotation) * x + Math.cos(pose.rotation) * y,
  }
}

test('pet rest is awake lying, sit has supported vertical haunches, and bow is an articulated silhouette', () => {
  for (const species of ['cat', 'dog']) {
    const spec = specimens.get(species)!,
      rig = animalRig(spec)
    const find = (name: string) => rig.find((p) => p.name === name)!
    for (const time of [0.4, 1.2, 2.5]) {
      const rest = state(spec, 'rest', { time, domain: 'ground' })
      assert.equal(animalPartPose(find('rest-body'), rest).alpha, 1)
      assert.equal(animalPartPose(find('sleep-body'), rest).alpha, 0)
      const sleep = state(spec, 'sleep', { time, domain: 'ground' })
      assert.equal(animalPartPose(find('eye-open'), sleep).alpha, 0)
      assert.equal(animalPartPose(find('sleep-body'), sleep).alpha, 1)
      const sit = state(spec, 'sit', { time, domain: 'ground' })
      assert.equal(animalPartPose(find('sit-body'), sit).alpha, 1)
      assert.equal(animalPartPose(find('body'), sit).alpha, 0)
      for (const [action, names] of [
        ['rest', ['rest-paws']],
        ['sit', ['sit-paws']],
        ['stretch', ['bow-hind-legs', 'bow-front-legs']],
        ...(species === 'dog' ? [['play', ['bow-hind-legs', 'bow-front-legs']]] : []),
      ] as [string, string[]][])
        for (const heading of [-1, 1])
          for (const name of names) {
            const part = find(name),
              pose = animalPartPose(part, state(spec, action, { time, heading, domain: 'perch' }))
            assert.equal(pose.alpha, 1)
            const bottom = Math.max(
              ...part.shapes.flatMap((shape) =>
                shape.points.map(
                  (point) => partPoint(part, pose, point).y + (shape.strokeWidth ?? 0) / 2,
                ),
              ),
            )
            assert.ok(
              bottom >= -0.6 && bottom <= 1.1,
              `${species}/${action}/${name}: paw remains on support (${bottom})`,
            )
          }
    }
    const silhouettes = ['walk', 'rest', 'sleep', 'sit', 'stretch'].map((action) =>
      animalPoseSvg(spec, state(spec, action, { domain: 'ground' })),
    )
    assert.equal(
      new Set(silhouettes).size,
      5,
      `${species}: five genuinely different cached silhouettes`,
    )
    assert.ok(find('sit-body').shapes[0].points.length > 20)
    const bow = find('bow-front-legs').shapes.flatMap((shape) => shape.points)
    assert.ok(
      Math.max(...bow.map((p) => p.x)) - Math.min(...bow.map((p) => p.x)) >= 25,
      'long reaching forelegs, not oval scaling',
    )
  }
})

test('new pet routines retain the existing opaque collision widths and every facial layer follows one head joint', () => {
  const limits: Record<string, Record<string, [number, number]>> = {
    cat: {
      rest: [43, 46],
      sleep: [43, 46],
      sit: [39, 50],
      play: [39, 50],
      stretch: [43, 50],
      groom: [39, 55],
      sniff: [39, 52],
      observe: [39, 50],
      eat: [39, 58],
    },
    dog: {
      rest: [49, 61],
      sleep: [49, 61],
      sit: [45, 65],
      play: [45, 65],
      stretch: [50, 65],
      groom: [45, 61],
      sniff: [45, 67],
      observe: [45, 65],
      eat: [45, 57],
    },
  }
  for (const species of ['cat', 'dog']) {
    const spec = specimens.get(species)!,
      rig = animalRig(spec)
    for (const [action, [back, front]] of Object.entries(limits[species]))
      for (let tick = 0; tick < 120; tick++) {
        const time = tick / 20,
          s = state(spec, action, { time, domain: 'ground' })
        for (const part of rig.filter((part) => !['tail', 'shadow'].includes(part.motion ?? ''))) {
          const pose = animalPartPose(part, s)
          if (!pose.alpha) continue
          for (const shape of part.shapes)
            for (const point of shape.points) {
              const p = partPoint(part, pose, point),
                margin = (shape.strokeWidth ?? 0) / 2
              assert.ok(
                p.x - margin >= -back - 0.01 && p.x + margin <= front + 0.01,
                `${species}/${action}/${part.name}: ${p.x - margin}..${p.x + margin} within -${back}..${front}`,
              )
            }
        }
        const head = rig.find((p) => p.name === 'head')!,
          headPose = animalPartPose(head, s)
        const joint = partPoint(head, headPose, { x: 0, y: 0 })
        for (const eye of rig.filter((p) => ['eye-open', 'eye-closed'].includes(p.motion ?? ''))) {
          const pose = animalPartPose(eye, s),
            eyeJoint = partPoint(eye, pose, { x: 0, y: 0 })
          assert.ok(Math.hypot(joint.x - eyeJoint.x, joint.y - eyeJoint.y) < 1e-8)
          assert.equal(pose.rotation, headPose.rotation)
        }
      }
  }
})
