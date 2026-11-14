import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import {
  getScenePlants,
  SCENE_PLANTS,
  validateScenePlants,
} from '../src/pages/focus/model/scenePlants.ts'

test('authored plants cover every room with diverse silhouettes and physical supports', () => {
  assert.deepEqual(validateScenePlants(), [])
  assert.deepEqual(Object.keys(SCENE_PLANTS).sort(), BACKGROUNDS.map((room) => room.id).sort())
  const plants = BACKGROUNDS.flatMap((room) => {
    const arrangements = getScenePlants(room)
    assert.ok(arrangements.length >= 1 && arrangements.length <= 3, room.id)
    assert.deepEqual(getScenePlants(room.id), arrangements)
    for (const plant of arrangements) {
      if (plant.support === 'stand') {
        assert.equal(plant.y, 660)
        assert.ok(plant.floorY! > plant.y)
      }
      if (plant.support === 'hanging') assert.ok(plant.mountY! < plant.y)
      if (plant.support === 'shelf') assert.ok(Number.isFinite(plant.mountX))
    }
    return arrangements
  })
  assert.equal(new Set(plants.map((plant) => plant.species)).size, 15)
  assert.equal(new Set(plants.map((plant) => plant.container)).size, 7)
  assert.equal(new Set(plants.map((plant) => plant.support)).size, 4)
})
