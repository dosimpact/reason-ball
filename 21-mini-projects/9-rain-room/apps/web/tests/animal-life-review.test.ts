import test from 'node:test'
import assert from 'node:assert/strict'
import { ANIMAL_HABITATS } from '../src/pages/focus/model/animalHabitats.ts'
import { AnimalLifeSimulation } from '../src/pages/focus/model/animalLife.ts'
import { animalRig, animalPartPose } from '../src/pages/focus/lib/animalDrawing.ts'

test('every mobile actor makes real routine progress across independent seeds, rather than only changing idle labels', () => {
  for (const seed of [31, 591, 20261112]) {
    for (const plan of Object.values(ANIMAL_HABITATS)) {
      const sim = new AnimalLifeSimulation(plan, seed)
      const origin = new Map(sim.snapshot().map((s) => [s.id, { x: s.x, y: s.y }]))
      const distance = new Map(plan.actors.map((a) => [a.id, 0]))
      const actions = new Map(plan.actors.map((a) => [a.id, new Set<string>()]))
      try {
        for (let tick = 0; tick < 6000; tick++) {
          sim.step(0.1)
          for (const state of sim.snapshot()) {
            const start = origin.get(state.id)!
            actions.get(state.id)!.add(state.action)
            distance.set(
              state.id,
              Math.max(distance.get(state.id)!, Math.hypot(state.x - start.x, state.y - start.y)),
            )
            const zone = plan.zones.find((z) => z.id === state.zoneId)!
            assert.equal(
              state.domain,
              zone.domain,
              `${state.id}: pose domain must match current support`,
            )
            if (
              zone.domain === 'air' &&
              plan.actors.find((a) => a.id === state.id)!.species !== 'spider'
            )
              assert.ok(
                !['sleep', 'groom', 'stretch'].includes(state.action),
                `${state.id}: unsupported terrestrial routine`,
              )
          }
        }
        for (const actor of plan.actors) {
          if (plan.resources.some((r) => r.kind === 'food' && r.consumerId === actor.id))
            assert.ok(
              actions.get(actor.id)!.has('eat'),
              `${actor.id} seed${seed}: authored food never reached in ten minutes`,
            )
          // The source hero is deliberately a giant stationary sleeping dragon.
          if (actor.species === 'dragon') continue
          const zone = plan.zones.find((z) => z.id === actor.zoneId)!
          const anchoredPost =
            actor.source &&
            zone.domain === 'perch' &&
            zone.support === 'post' &&
            zone.route.length > 0 &&
            zone.route.every((p) => p.x === actor.home.x && p.y === actor.home.y)
          if (anchoredPost) {
            // This authored finite post has no landing link or spare contact surface.
            assert.equal(plan.id, 'water-harbor')
            assert.ok(
              actions.get(actor.id)!.size >= 3,
              'anchored animal retains varied supported routines',
            )
            const part = animalRig(actor).find((p) => p.motion === 'head')!
            const pose = (time: number) =>
              animalPartPose(part, {
                id: actor.id,
                ...actor.home,
                action: 'observe',
                heading: 1,
                phase: 0.5,
                time,
                domain: zone.domain,
              })
            assert.notDeepEqual(pose(0), pose(1), 'anchored animal has continuous joint motion')
            continue
          }
          assert.ok(
            distance.get(actor.id)! > 0.05,
            `${plan.id}/${actor.id} seed${seed}: stationary for ten minutes`,
          )
        }
      } finally {
        sim.dispose()
      }
    }
  }
})
