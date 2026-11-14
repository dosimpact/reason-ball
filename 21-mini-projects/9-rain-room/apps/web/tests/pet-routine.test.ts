import test from 'node:test'
import assert from 'node:assert/strict'
import { ANIMAL_HABITATS } from '../src/pages/focus/model/animalHabitats.ts'
import { ANIMAL_SPECIES } from '../src/pages/focus/model/animalSpecies.ts'
import {
  AnimalLifeSimulation,
  animalFitsZone,
  animalSegmentFits,
} from '../src/pages/focus/model/animalLife.ts'

const rooms = Object.values(ANIMAL_HABITATS).filter((p) =>
  p.actors.some((a) => a.species === 'cat' || a.species === 'dog'),
)
const runtimeSeed = (id: string) => [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0)
const isPet = (species: string) => species === 'cat' || species === 'dog'

test('all33 pets show supported, quiet daily variety in the first120s for real room seeds and alternate seeds', () => {
  assert.equal(rooms.flatMap((p) => p.actors.filter((a) => isPet(a.species))).length, 33)
  for (const alternate of [0, 31, 591]) {
    const openings = new Set<string>()
    for (const room of rooms) {
      const sim = new AnimalLifeSimulation(room, runtimeSeed(room.id) + alternate)
      const pets = room.actors.filter((a) => isPet(a.species))
      const metrics = new Map(
        pets.map((a) => [
          a.id,
          { actions: new Set<string>(), eat: 0, quiet: 0, transitions: 0, last: '' },
        ]),
      )
      let previous = sim.snapshot()
      for (const a of previous) if (metrics.has(a.id)) openings.add(a.action)
      for (let i = 0; i < 1200; i++) {
        sim.step(0.1)
        const states = sim.snapshot()
        for (const spec of pets) {
          const state = states.find((a) => a.id === spec.id)!
          const before = previous.find((a) => a.id === spec.id)!
          const m = metrics.get(spec.id)!
          const zone = room.zones.find((z) => z.id === state.zoneId)!
          assert.ok(
            ANIMAL_SPECIES[spec.species].actions.includes(state.action),
            `${spec.id}: allowed ${state.action}`,
          )
          assert.ok(animalFitsZone(spec, zone, state), `${spec.id}: supported pose`)
          assert.ok(animalSegmentFits(spec, zone, before, state), `${spec.id}: supported path`)
          if (state.action === 'walk' && before.action === 'walk' && !state.partnerId)
            assert.ok(
              Math.hypot(state.x - before.x, state.y - before.y) > 0,
              `${spec.id}: no idle walking`,
            )
          m.actions.add(state.action)
          if (m.last && m.last !== state.action) m.transitions++
          m.last = state.action
          if (state.action === 'eat') m.eat++
          if (['rest', 'sleep', 'sit', 'observe', 'groom'].includes(state.action)) m.quiet++
        }
        previous = states
      }
      for (const [id, m] of metrics) {
        assert.ok(m.actions.size >= 4, `${id}: first120s variety: ${[...m.actions]}`)
        assert.ok(
          [...m.actions].some((a) => ['sit', 'play', 'sniff', 'groom', 'stretch'].includes(a)),
          `${id}: visible daily gesture`,
        )
        assert.ok(m.eat < 120, `${id}: eating is not dominant`)
        assert.ok(m.quiet > 360, `${id}: calm majority, not constant activity`)
        assert.ok(m.transitions < 35, `${id}: no rapid repeated action loop`)
      }
      sim.dispose()
    }
    assert.ok(openings.size >= 6, `varied openings: ${[...openings]}`)
  }
})

test('pet routines are deterministic and pause freezes their continuous and action clocks', () => {
  for (const room of rooms) {
    const a = new AnimalLifeSimulation(room, runtimeSeed(room.id))
    const b = new AnimalLifeSimulation(room, runtimeSeed(room.id))
    for (let i = 0; i < 120; i++) {
      a.step(1)
      b.step(1)
    }
    assert.deepEqual(a.snapshot(), b.snapshot())
    const frozen = a.snapshot()
    a.setPaused(true)
    a.step(600)
    assert.deepEqual(a.snapshot(), frozen)
    a.setPaused(false)
    a.step(1)
    b.step(1)
    assert.deepEqual(a.snapshot(), b.snapshot())
    a.dispose()
    b.dispose()
  }
})

test('all pets retain feeding and species grooming over ten minutes without pet poses leaking to wildlife', () => {
  for (const room of rooms) {
    const sim = new AnimalLifeSimulation(room, runtimeSeed(room.id))
    const metrics = new Map(
      room.actors.filter((a) => isPet(a.species)).map((a) => [a.id, { eat: 0, groom: 0 }]),
    )
    for (let i = 0; i < 6000; i++) {
      sim.step(0.1)
      for (const state of sim.snapshot()) {
        const m = metrics.get(state.id)
        if (m) {
          if (state.action === 'eat') m.eat++
          if (state.action === 'groom') m.groom++
        } else
          assert.ok(
            !['sit', 'play'].includes(state.action),
            `${state.id}: wildlife retains its species repertoire`,
          )
      }
    }
    for (const [id, m] of metrics) {
      assert.ok(m.eat > 0 && m.eat < 300, `${id}: real, infrequent feeding`)
      assert.ok(m.groom > 0, `${id}: cat wash or dog scratch remains reachable`)
    }
    sim.dispose()
  }
})

test('every pet can take a real supported walk even when a shared route endpoint is occupied', () => {
  for (const seed of [31, 591, 20261112, 'runtime'] as const) {
    for (const room of rooms) {
      const sim = new AnimalLifeSimulation(room, seed === 'runtime' ? runtimeSeed(room.id) : seed)
      const pets = room.actors.filter((a) => isPet(a.species))
      const distances = new Map(pets.map((a) => [a.id, 0]))
      let previous = sim.snapshot()
      for (let i = 0; i < 6000; i++) {
        sim.step(0.1)
        const states = sim.snapshot()
        for (const spec of pets) {
          const a = states.find((s) => s.id === spec.id)!
          const b = previous.find((s) => s.id === spec.id)!
          distances.set(a.id, distances.get(a.id)! + Math.hypot(a.x - b.x, a.y - b.y))
          const zone = room.zones.find((z) => z.id === a.zoneId)!
          assert.ok(
            animalSegmentFits(spec, zone, b, a),
            `${spec.id}: the short route remains supported`,
          )
        }
        previous = states
      }
      for (const [id, distance] of distances)
        assert.ok(distance > 0.05, `${id} seed${seed}: actual translation over600s`)
      sim.dispose()
    }
  }
})
