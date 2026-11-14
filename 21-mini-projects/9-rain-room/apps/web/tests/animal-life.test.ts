import test from 'node:test'
import {
  animalPoseBounds,
  animalRig,
  animalPartPose,
} from '../src/pages/focus/lib/animalDrawing.ts'
import assert from 'node:assert/strict'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { ANIMAL_SPECIES, ANIMAL_FEEDING_OFFSET } from '../src/pages/focus/model/animalSpecies.ts'
import {
  ANIMAL_HABITATS,
  getAnimalHabitat,
  ordinaryBranchSurface,
  type AnimalHabitat,
  type AnimalSpec,
  type NavZone,
} from '../src/pages/focus/model/animalHabitats.ts'
import {
  AnimalLifeSimulation,
  animalFitsZone,
  animalSegmentFits,
  pointInAnimalPolygon,
} from '../src/pages/focus/model/animalLife.ts'

test('all 68 habitats inventory existing secondary actors and a bounded deliberate social cast', () => {
  assert.deepEqual(Object.keys(ANIMAL_HABITATS).sort(), ALL_BACKGROUNDS.map((r) => r.id).sort())
  const actors = Object.values(ANIMAL_HABITATS).flatMap((p) => p.actors)
  assert.equal(
    actors.filter((a) => a.source).length,
    86,
    '40 ordinary,26 premium pets,dragon,14 signatures,fish3,bats2',
  )
  assert.equal(actors.filter((a) => !a.source).length, 4)
  assert.equal(new Set(actors.map((a) => a.id)).size, actors.length)
  assert.equal(new Set(actors.map((a) => a.species)).size, 22)
  for (const plan of Object.values(ANIMAL_HABITATS)) {
    assert.ok(plan.actors.length <= 8)
    assert.equal(plan.policy, plan.actors.length ? 'authored' : 'quiet')
    const simulation = new AnimalLifeSimulation(plan)
    for (const actor of plan.actors) {
      const zone = plan.zones.find((z) => z.id === actor.zoneId)!
      assert.ok(ANIMAL_SPECIES[actor.species].domains.includes(zone.domain), actor.id)
      assert.ok(animalFitsZone(actor, zone, actor.home), actor.id)
      if (actor.source) assert.ok(actor.source.selector && Number.isInteger(actor.source.index))
    }
    for (const resource of plan.resources)
      assert.ok(plan.zones.some((z) => z.id === resource.zoneId))
    simulation.dispose()
  }
  const bat = getAnimalHabitat('premium-halloween-greenhouse').actors.filter(
    (a) => a.species === 'bat',
  )
  assert.deepEqual(
    bat.map((a) => a.source?.part),
    [0, 1],
  )
  assert.ok(bat.every((a) => a.source?.selector === '.premium-bat' && a.source.index === 0))
  const fireflies = getAnimalHabitat('premium-spirit-tree').actors.filter(
    (a) => a.species === 'firefly',
  )
  assert.deepEqual(
    fireflies.map((a) => a.source?.part),
    [0, 1, 2],
  )
  assert.equal(new Set(fireflies.map((a) => a.id)).size, 3)
  assert.ok(
    fireflies.every(
      (a) =>
        a.source?.selector === '[data-premium-motion="spirit-tree-firefly"]' &&
        a.source.index === 0 &&
        a.sourceMotionId === 'spirit-tree-firefly',
    ),
  )
  const ray = getAnimalHabitat('premium-underwater-library').actors.find(
    (a) => a.species === 'ray',
  )!
  assert.equal(ray.coat, '#709a9c')
  assert.equal(ray.marking, '#a1b9aa')
  const dragon = getAnimalHabitat('premium-dragon-study').actors.find(
    (a) => a.species === 'dragon',
  )!
  assert.equal(dragon.slotOf, 'dragon-study-wing')
  for (const actor of actors.filter(
    (a) => a.sourceMotionId && ['moth', 'butterfly', 'ray', 'jellyfish'].includes(a.species),
  ))
    assert.deepEqual(actor.source?.supportSelectors, [], 'never preserve a moving body as support')
})

test('authored branch contact follows the actual support and stations meet feeding mouths', () => {
  const plan = getAnimalHabitat('forest-autumn')
  const squirrels = plan.actors.filter((a) => a.species === 'squirrel')
  for (const actor of squirrels) {
    const expected = 490 + ordinaryBranchSurface((actor.home.x - 610) / 0.7) * 0.7
    assert.ok(Math.abs(actor.home.y - expected) < 1e-8)
  }
  const simulation = new AnimalLifeSimulation(plan, 42)
  for (let n = 0; n < 3000; n++) {
    simulation.step(0.1)
    for (const state of simulation.snapshot().filter((s) => squirrels.some((a) => a.id === s.id))) {
      const expected = 490 + ordinaryBranchSurface((state.x - 610) / 0.7) * 0.7
      assert.ok(
        Math.abs(state.y - expected) < 0.15,
        'feet follow the curved branch during routines and greetings',
      )
    }
  }
  for (const habitat of Object.values(ANIMAL_HABITATS))
    for (const resource of habitat.resources.filter((r) => r.kind === 'food')) {
      const actor = habitat.actors.find((a) => a.id === resource.consumerId)!
      const mouth = ANIMAL_FEEDING_OFFSET[actor.species]
      assert.ok(resource.approach)
      assert.ok(resource.heading === 1 || resource.heading === -1)
      assert.ok(
        Math.abs(
          resource.position.x - resource.approach.x - mouth.x * actor.scale * resource.heading!,
        ) < 1e-8,
      )
      assert.ok(Math.abs(resource.position.y - resource.approach.y - mouth.y * actor.scale) < 1e-8)
      const zone = habitat.zones.find((z) => z.id === resource.zoneId)!
      assert.ok(
        animalFitsZone(actor, zone, resource.approach),
        `${actor.id}: feeding feet remain supported`,
      )
      if (zone.support === 'branch') {
        const author = habitat.actors.find((a) => a.zoneId === zone.id && a.source?.origin)!
        const origin = author.source!.origin!,
          signature = Boolean(author.sourceMotionId)
        const left = Math.max(0, origin.x + (signature ? -90 : -65) * author.scale),
          right = Math.min(800, origin.x + (signature ? 105 : 1200) * author.scale)
        assert.ok(
          resource.position.x - 13 >= left - 1e-8 && resource.position.x + 13 <= right + 1e-8,
          `${actor.id}: all scattered seeds remain on the actual authored branch`,
        )
      } else if (zone.support === 'bench' || zone.support === 'chair') {
        const origin = actor.source!.origin!
        const left =
          zone.support === 'chair'
            ? 60
            : origin.x - (actor.species === 'dog' ? 76 : 60) * actor.scale
        const right =
          zone.support === 'chair'
            ? 210
            : origin.x + (actor.species === 'dog' ? 76 : 60) * actor.scale
        const halfBowl = 7.5 * actor.scale
        assert.ok(
          resource.position.x - halfBowl >= left - 1e-8 &&
            resource.position.x + halfBowl <= right + 1e-8,
          `${actor.id}: the complete food bowl rests on its finite original seat`,
        )
        const xs = zone.route.map((p) => p.x)
        assert.ok(
          resource.position.x < Math.min(...xs) || resource.position.x > Math.max(...xs),
          `${actor.id}: the bowl remains clear of the walking corridor`,
        )
      } else if (zone.boundsPolicy === 'contact') {
        const xs = zone.route.map((p) => p.x)
        assert.ok(
          resource.position.x < Math.min(...xs) || resource.position.x > Math.max(...xs),
          `${actor.id}: solid food vessel must stay beyond the walking corridor`,
        )
      }
    }
  simulation.dispose()
})

test('ten minute routines remain bounded and species-valid with no same-surface body overlap', () => {
  const actions = new Set<string>()
  for (const plan of Object.values(ANIMAL_HABITATS)) {
    const sim = new AnimalLifeSimulation(plan, 591)
    for (let tick = 0; tick < 6000; tick++) {
      sim.step(0.1)
      const states = sim.snapshot()
      for (const state of states) {
        const actor = plan.actors.find((a) => a.id === state.id)!,
          traits = ANIMAL_SPECIES[actor.species],
          zone = plan.zones.find((z) => z.id === state.zoneId)!
        assert.ok(animalFitsZone(actor, zone, state), `${actor.id}: surface boundary`)
        assert.ok(traits.actions.includes(state.action), `${actor.id}: ${state.action}`)
        assert.ok(Number.isFinite(state.phase) && state.phase >= 0 && state.phase <= 1)
        assert.ok(Object.values(state.needs).every((v) => v >= 0 && v <= 1))
        assert.equal(state.zoneId, actor.zoneId, 'no invented link across habitats/windows/chairs')
        if (state.action === 'eat')
          assert.ok(
            plan.resources.some(
              (r) =>
                r.kind === 'food' &&
                r.zoneId === state.zoneId &&
                r.consumerId === actor.id &&
                r.heading === state.heading &&
                Math.hypot(
                  (r.approach ?? r.position).x - state.x,
                  (r.approach ?? r.position).y - state.y,
                ) < 0.4,
            ),
            `${actor.id}: eating requires a reachable food station`,
          )
        assert.ok(Number.isFinite(state.time) && state.time >= 0)
        assert.ok(state.gaitPhase >= 0 && state.gaitPhase < 1)
        actions.add(state.action)
      }
      for (let i = 0; i < states.length; i++)
        for (let j = i + 1; j < states.length; j++)
          if (states[i].zoneId === states[j].zoneId) {
            const a = plan.actors[i],
              b = plan.actors[j],
              ra = ANIMAL_SPECIES[a.species].footprint,
              rb = ANIMAL_SPECIES[b.species].footprint
            const normalized =
              ((states[i].x - states[j].x) / (ra.halfWidth * a.scale + rb.halfWidth * b.scale)) **
                2 +
              ((states[i].y - states[j].y) / (ra.halfDepth * a.scale + rb.halfDepth * b.scale)) ** 2
            assert.ok(normalized >= 1 - 1e-5, `${plan.id}: ${a.id}/${b.id} overlap`)
          }
    }
    sim.dispose()
  }
  for (const action of [
    'rest',
    'sleep',
    'eat',
    'walk',
    'hop',
    'fly',
    'swim',
    'groom',
    'stretch',
    'sniff',
    'nuzzle',
    'headbump',
  ])
    assert.ok(actions.has(action), `${action} must actually occur`)
})

test('compatible authored pairs actually greet and touch without sharing unreachable habitats', () => {
  for (const id of ['garden-court', 'forest-autumn', 'water-lake', 'premium-last-bookstore']) {
    const sim = new AnimalLifeSimulation(getAnimalHabitat(id), 2),
      seen = new Set<string>()
    for (let i = 0; i < 6000; i++) {
      sim.step(0.1)
      for (const state of sim.snapshot()) if (state.partnerId) seen.add(state.action)
    }
    assert.ok(
      sim
        .snapshot()
        .every((state) =>
          Object.values(state.relationships).some(
            (relation) => relation.affinity > 0 && relation.lastInteraction > 0,
          ),
        ),
      `${id}: reciprocal relationship memory`,
    )
    assert.ok(
      seen.has('sniff') && seen.has('nuzzle') && seen.has('headbump'),
      `${id}: social routine liveness`,
    )
  }
  const plan = getAnimalHabitat('cafe-rain'),
    sim = new AnimalLifeSimulation(plan, 1)
  sim.step(600)
  assert.ok(
    sim.snapshot().every((a) => !a.partnerId),
    'two pets on disconnected benches cannot greet',
  )
})

test('fixed 10Hz updates are seeded, paused time is excluded, snapshots detached and dispose final', () => {
  const plan = getAnimalHabitat('premium-last-bookstore'),
    a = new AnimalLifeSimulation(plan, 55),
    b = new AnimalLifeSimulation(plan, 55)
  for (let i = 0; i < 1000; i++) a.step(0.1)
  b.step(100)
  assert.deepEqual(a.snapshot(), b.snapshot())
  const before = a.snapshot()
  a.setPaused(true)
  a.step(300)
  a.interact(before[0].id)
  assert.deepEqual(a.snapshot(), before)
  a.setPaused(false)
  a.interact(before[0].id)
  assert.equal(a.snapshot()[0].emotion, 'curious')
  a.interact(before[0].id)
  assert.equal(a.snapshot()[0].emotion, 'startled')
  const snapshot = a.snapshot()
  snapshot[0].needs.hunger = 999
  assert.ok(a.snapshot()[0].needs.hunger <= 1)
  a.dispose()
  const final = a.snapshot()
  a.step(300)
  a.interact(final[0].id)
  assert.deepEqual(a.snapshot(), final)
  assert.throws(() => b.step(NaN), RangeError)
})

test('body footprints and continuous paths cannot tunnel through holes or unsupported space', () => {
  const actor: AnimalSpec = {
    id: 'test',
    species: 'snail',
    home: { x: 30, y: 30 },
    scale: 0.2,
    coat: '#aaaaaa',
    zoneId: 'z',
  }
  const zone: NavZone = {
    id: 'z',
    domain: 'ground',
    habitat: 'indoor',
    layer: 'interior',
    polygon: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    holes: [
      [
        { x: 45, y: 0 },
        { x: 55, y: 0 },
        { x: 55, y: 80 },
        { x: 45, y: 80 },
      ],
    ],
    route: [
      { x: 30, y: 30 },
      { x: 70, y: 30 },
    ],
    support: 'floor',
    boundsPolicy: 'contact',
  }
  assert.equal(
    animalFitsZone(actor, zone, { x: 1, y: 30 }),
    false,
    'whole footprint, not center alone',
  )
  assert.equal(animalFitsZone(actor, zone, actor.home), true)
  assert.equal(
    animalSegmentFits(actor, zone, actor.home, { x: 70, y: 30 }),
    false,
    'continuous segment crosses obstacle',
  )
})

test('spider stays attached to one fixed thread and fish never use terrestrial grooming or nuzzling', () => {
  const plan = getAnimalHabitat('premium-halloween-greenhouse'),
    spider = plan.actors.find((a) => a.species === 'spider')!,
    zone = plan.zones.find((z) => z.id === spider.zoneId)!
  assert.deepEqual(zone.anchor, { x: 680, y: 205 })
  assert.ok(zone.route.every((p) => p.x === zone.anchor!.x))
  assert.deepEqual(
    spider.source?.supportSelectors,
    [],
    'renderer draws a connected tether, not a leftover body or duplicate thread',
  )
  const sim = new AnimalLifeSimulation(plan, 19)
  for (let i = 0; i < 3000; i++) {
    sim.step(0.1)
    assert.equal(sim.snapshot().find((a) => a.id === spider.id)!.x, 680)
  }
  const aquarium = new AnimalLifeSimulation(getAnimalHabitat('premium-underwater-library'), 9)
  for (let i = 0; i < 3000; i++) {
    aquarium.step(0.1)
    assert.ok(
      aquarium
        .snapshot()
        .filter(
          (a) =>
            getAnimalHabitat('premium-underwater-library').actors.find((spec) => spec.id === a.id)!
              .species !== 'owl',
        )
        .every((a) => !['groom', 'stretch', 'nuzzle', 'headbump'].includes(a.action)),
    )
  }
})

test('a routine blocked by another body yields immediately without an overlap or boundary shove', () => {
  const zone: NavZone = {
    id: 'safe',
    domain: 'ground',
    habitat: 'indoor',
    layer: 'interior',
    polygon: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 0, y: 40 },
    ],
    holes: [],
    route: [
      { x: 30, y: 20 },
      { x: 60, y: 20 },
    ],
    support: 'floor',
    boundsPolicy: 'contact',
  }
  const plan: AnimalHabitat = {
    id: 'collision-test',
    policy: 'authored',
    zones: [zone],
    links: [],
    resources: [],
    actors: [
      {
        id: 'a',
        species: 'snail',
        home: { x: 35, y: 20 },
        scale: 0.2,
        coat: '#999999',
        zoneId: 'safe',
      },
      {
        id: 'b',
        species: 'snail',
        home: { x: 55, y: 20 },
        scale: 0.2,
        coat: '#777777',
        zoneId: 'safe',
      },
    ],
  }
  const sim = new AnimalLifeSimulation(plan, 9)
  let reacted = false
  for (let tick = 0; tick < 6000; tick++) {
    const before = sim.snapshot()
    sim.step(0.1)
    const after = sim.snapshot()
    for (let i = 0; i < after.length; i++)
      if (after[i].action === 'yield' && before[i].action === 'walk') {
        assert.equal(after[i].emotion, 'startled')
        assert.ok(after[i].phase <= 0.1, 'reaction is immediate, not a 20-second stall')
        assert.ok(animalFitsZone(plan.actors[i], zone, after[i]))
        reacted = true
      }
    assert.ok(Math.abs(after[0].x - after[1].x) >= 9.2 - 1e-5)
  }
  assert.ok(reacted, 'routine movement should actually meet and yield')
})

test('actual airborne and submerged poses fit their body volumes, with a collision-safe shared swarm', () => {
  for (const plan of Object.values(ANIMAL_HABITATS)) {
    if (!plan.zones.some((z) => z.boundsPolicy === 'body')) continue
    const sim = new AnimalLifeSimulation(plan, 21)
    for (let n = 0; n < 900; n++) {
      sim.step(0.2)
      const posed = []
      for (const state of sim.snapshot()) {
        const actor = plan.actors.find((a) => a.id === state.id)!,
          zone = plan.zones.find((z) => z.id === state.zoneId)!
        assert.equal(state.domain, zone.domain)
        if (zone.domain === 'air' && zone.support !== 'thread')
          assert.ok(
            !['sleep', 'groom', 'stretch', 'walk', 'hop'].includes(state.action),
            `${actor.id}: unsupported air routine`,
          )
        if (zone.boundsPolicy !== 'body') continue
        const bounds = animalPoseBounds({ ...actor, tetherAnchor: zone.anchor }, state)
        for (const point of [
          { x: bounds.x, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y },
          { x: bounds.x, y: bounds.y + bounds.height },
          { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        ])
          assert.ok(
            pointInAnimalPolygon(point, zone.polygon),
            `${actor.id}: actual ${state.action} pose leaves body volume`,
          )
        if (actor.species === 'firefly') posed.push(bounds)
      }
      for (let a = 0; a < posed.length; a++)
        for (let b = a + 1; b < posed.length; b++)
          assert.ok(
            posed[a].x + posed[a].width <= posed[b].x ||
              posed[b].x + posed[b].width <= posed[a].x ||
              posed[a].y + posed[a].height <= posed[b].y ||
              posed[b].y + posed[b].height <= posed[a].y,
            'actual firefly bodies stay separate (glow excluded)',
          )
    }
    sim.dispose()
  }
  const swarm = getAnimalHabitat('premium-spirit-tree').actors.filter(
    (a) => a.species === 'firefly',
  )
  assert.equal(new Set(swarm.map((a) => a.zoneId)).size, 1)
})

test('reserved social approaches use articulated locomotion rather than sliding in greeting poses', () => {
  let approaches = 0
  for (const id of [
    'garden-court',
    'forest-autumn',
    'water-lake',
    'premium-last-bookstore',
    'premium-spirit-tree',
  ]) {
    const sim = new AnimalLifeSimulation(getAnimalHabitat(id), 42)
    for (let n = 0; n < 3000; n++) {
      const before = sim.snapshot()
      sim.step(0.1)
      for (const state of sim.snapshot()) {
        const previous = before.find((s) => s.id === state.id)!
        if (previous.partnerId && Math.hypot(previous.x - state.x, previous.y - state.y) > 0.001) {
          assert.ok(
            ['walk', 'hop', 'fly', 'swim'].includes(previous.action),
            `${id}: social approach must move its limbs`,
          )
          approaches++
        }
      }
    }
    sim.dispose()
  }
  assert.ok(approaches > 0)
})

test('each crowded water actor moves and reaches food without a repeated blocked-feeding loop', () => {
  for (const seed of [1, 42, 2026])
    for (const id of ['garden-lotus', 'water-harbor-deep', 'premium-underwater-library']) {
      const plan = getAnimalHabitat(id),
        sim = new AnimalLifeSimulation(plan, seed)
      const tracked = plan.actors.filter(
        (a) =>
          id !== 'premium-underwater-library' || ['jellyfish', 'fish', 'ray'].includes(a.species),
      )
      const distance = new Map(tracked.map((a) => [a.id, 0])),
        eating = new Map(tracked.map((a) => [a.id, 0])),
        yielding = new Map(tracked.map((a) => [a.id, 0])),
        previous = new Map(sim.snapshot().map((s) => [s.id, s]))
      for (let n = 0; n < 6000; n++) {
        sim.step(0.1)
        for (const state of sim.snapshot()) {
          const before = previous.get(state.id)!
          if (distance.has(state.id))
            distance.set(
              state.id,
              distance.get(state.id)! + Math.hypot(state.x - before.x, state.y - before.y),
            )
          if (eating.has(state.id) && state.action === 'eat')
            eating.set(state.id, eating.get(state.id)! + 0.1)
          if (yielding.has(state.id) && state.action === 'yield')
            yielding.set(state.id, yielding.get(state.id)! + 0.1)
          previous.set(state.id, state)
        }
      }
      for (const actor of tracked) {
        assert.ok(
          eating.get(actor.id)! >= 7,
          `${actor.id}: reaches a valid meal, rather than endlessly retrying`,
        )
        assert.ok(
          yielding.get(actor.id)! < 120,
          `${actor.id}: blocked approaches must replan and recover`,
        )
        assert.ok(
          distance.get(actor.id)! > 20,
          `${actor.id} seed${seed}: real safe movement must occur`,
        )
      }
      sim.dispose()
    }
})

test('actual posed heads and torsos stay distinct during routines and reserved social contact', () => {
  const solidBounds = (
    spec: AnimalSpec,
    state: ReturnType<AnimalLifeSimulation['snapshot']>[number],
  ) => {
    const points = animalRig(spec)
      .filter(
        (part) =>
          ['head', 'body', 'awake-body', 'sleep-body', 'neck', 'folded-wing'].includes(
            part.motion ?? '',
          ) ||
          // Alternate pet silhouettes replace the standing torso. Include their actual bodies,
          // while paws and the decorative tail may touch during a friendly greeting.
          ['rest-body', 'sit-body', 'sit-haunch', 'bow-body'].includes(part.name),
      )
      .flatMap((part) => {
        const pose = animalPartPose(part, state),
          o = part.svgOffset ?? { x: 0, y: 0 }
        if (pose.alpha <= 0) return []
        return part.shapes.flatMap((shape) =>
          shape.points.map((p) => {
            const x = (p.x + o.x) * pose.scaleX,
              y = (p.y + o.y) * pose.scaleY
            return {
              x:
                state.x +
                (pose.x + Math.cos(pose.rotation) * x - Math.sin(pose.rotation) * y) *
                  spec.scale *
                  state.heading,
              y:
                state.y +
                (pose.y + Math.sin(pose.rotation) * x + Math.cos(pose.rotation) * y) * spec.scale,
            }
          }),
        )
      })
    return {
      left: Math.min(...points.map((p) => p.x)),
      right: Math.max(...points.map((p) => p.x)),
      top: Math.min(...points.map((p) => p.y)),
      bottom: Math.max(...points.map((p) => p.y)),
    }
  }
  for (const seed of [1, 42, 2026])
    for (const id of ['forest-autumn', 'water-lake', 'garden-court', 'premium-last-bookstore']) {
      const plan = getAnimalHabitat(id),
        sim = new AnimalLifeSimulation(plan, seed)
      for (let n = -1; n < 6000; n++) {
        if (n >= 0) sim.step(0.1)
        if (n >= 0 && n % 10 !== 9) continue
        const states = sim.snapshot()
        for (let i = 0; i < states.length; i++)
          for (let j = i + 1; j < states.length; j++)
            if (states[i].zoneId === states[j].zoneId) {
              const a = solidBounds(plan.actors[i], states[i]),
                b = solidBounds(plan.actors[j], states[j])
              assert.ok(
                a.right <= b.left + 0.1 ||
                  b.right <= a.left + 0.1 ||
                  a.bottom <= b.top + 0.1 ||
                  b.bottom <= a.top + 0.1,
                `${id} seed${seed} t${(n + 1) / 10}: heads/torso must not fuse`,
              )
            }
      }
      sim.dispose()
    }
})

test('actors in overlapping same-plane air volumes do not fly through one another', () => {
  for (const seed of [1, 42, 2026])
    for (const plan of Object.values(ANIMAL_HABITATS)) {
      const air = plan.actors.filter(
        (a) => plan.zones.find((z) => z.id === a.zoneId)!.domain === 'air',
      )
      if (air.length < 2) continue
      const sim = new AnimalLifeSimulation(plan, seed)
      for (let n = 0; n < 3000; n++) {
        sim.step(0.1)
        if (n % 10 !== 9) continue
        const states = sim.snapshot()
        for (let i = 0; i < air.length; i++)
          for (let j = i + 1; j < air.length; j++) {
            const aa = air[i],
              bb = air[j],
              az = plan.zones.find((z) => z.id === aa.zoneId)!,
              bz = plan.zones.find((z) => z.id === bb.zoneId)!
            if (az.habitat !== bz.habitat || az.layer !== bz.layer) continue
            const a = animalPoseBounds(
                { ...aa, tetherAnchor: az.anchor },
                states.find((s) => s.id === aa.id)!,
              ),
              b = animalPoseBounds(
                { ...bb, tetherAnchor: bz.anchor },
                states.find((s) => s.id === bb.id)!,
              )
            assert.ok(
              a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y + a.height <= b.y ||
                b.y + b.height <= a.y,
              `${plan.id} seed${seed} t${(n + 1) / 10}: same-plane flying bodies intersect`,
            )
          }
      }
      sim.dispose()
    }
})
