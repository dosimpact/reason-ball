import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  getBackground,
  getBackgroundByScene,
  resolveBackgroundId,
  validateBackgrounds,
  validateSceneCatalogKeys,
} from '../src/pages/focus/model/backgrounds.ts'
import { getSceneInterior, validateSceneInteriors } from '../src/pages/focus/model/sceneInterior.ts'
import { getScenePlants, validateScenePlants } from '../src/pages/focus/model/scenePlants.ts'
import { getSceneAnimals, validateSceneAnimals } from '../src/pages/focus/model/sceneAnimals.ts'
import {
  getSceneSeats,
  getCharacterAppearance,
  validateSceneCast,
} from '../src/pages/focus/model/sceneCast.ts'
import {
  getSceneArchitecture,
  validateSceneArchitecture,
} from '../src/pages/focus/model/sceneArchitecture.ts'
import { getSceneEffects, validateSceneEffects } from '../src/pages/focus/model/sceneEffects.ts'
function roomConfig(id: string) {
  const room = getBackground(id)
  return {
    room,
    interior: getSceneInterior(id),
    plants: getScenePlants(id),
    animals: getSceneAnimals(id),
    seats: getSceneSeats(room),
    characters: getSceneSeats(room).map((_, index) => getCharacterAppearance(id, index)),
    architecture: getSceneArchitecture(id),
    effects: getSceneEffects(id),
  }
}
test('display order can change without changing any room configuration or its default', () => {
  const order = BACKGROUNDS.slice()
  const expected = new Map(order.map((room) => [room.id, JSON.stringify(roomConfig(room.id))]))
  try {
    BACKGROUNDS.reverse()
    for (const room of BACKGROUNDS) {
      assert.equal(JSON.stringify(roomConfig(room.id)), expected.get(room.id), room.id)
      assert.equal(getBackgroundByScene(room.scene).id, room.id)
      assert.deepEqual(getSceneInterior(room.scene), getSceneInterior(room.id))
      assert.deepEqual(getSceneArchitecture(room.scene), getSceneArchitecture(room.id))
    }
    assert.equal(getBackground().id, DEFAULT_BACKGROUND_ID)
    assert.equal(getBackground('obsolete').id, DEFAULT_BACKGROUND_ID)
    assert.equal(resolveBackgroundId(-999), DEFAULT_BACKGROUND_ID)
  } finally {
    BACKGROUNDS.splice(0, BACKGROUNDS.length, ...order)
  }
})
test('room metadata artwork selectors are independent of model lookup keys', () => {
  for (const room of BACKGROUNDS) {
    const renumbered = { ...room, scene: 9000 }
    assert.deepEqual(getSceneAnimals(renumbered), getSceneAnimals(room))
    assert.deepEqual(getScenePlants(renumbered), getScenePlants(room))
    assert.deepEqual(getSceneSeats(renumbered), getSceneSeats(room))
  }
})
test('catalog validators reject missing IDs, unknown IDs and duplicate selectors', () => {
  const complete = Object.fromEntries(BACKGROUNDS.map((room) => [room.id, {}]))
  assert.deepEqual(validateSceneCatalogKeys(complete, 'test'), [])
  const missing = { ...complete }
  delete missing['forest-cabin']
  assert.ok(
    validateSceneCatalogKeys(missing, 'test').some((error) =>
      error.includes('missing forest-cabin'),
    ),
  )
  assert.ok(
    validateSceneCatalogKeys({ ...complete, 'retired-room': {} }, 'test').some((error) =>
      error.includes('unexpected retired-room'),
    ),
  )
  const duplicate = BACKGROUNDS.map((room) => ({ ...room }))
  duplicate[1].scene = duplicate[0].scene
  assert.ok(validateBackgrounds(duplicate).some((error) => error.includes('duplicate artwork')))
  for (const validate of [
    validateBackgrounds,
    validateSceneInteriors,
    validateScenePlants,
    validateSceneAnimals,
    validateSceneCast,
    validateSceneArchitecture,
    validateSceneEffects,
  ])
    assert.deepEqual(validate(), [])
})
