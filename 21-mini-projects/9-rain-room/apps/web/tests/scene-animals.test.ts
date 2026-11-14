import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { getSceneAnimals, getIndoorCatAnchor } from '../src/pages/focus/model/sceneAnimals.ts'
test('room animal cast varies species and presence, keeping wildlife outside', () => {
  const species = new Set<string>()
  let empty = 0
  for (const room of BACKGROUNDS) {
    const animals = getSceneAnimals(room)
    assert.ok(animals.length <= 2, room.id)
    if (!animals.length) empty++
    for (const animal of animals) {
      species.add(animal.species)
      assert.ok(animal.x > 0 && animal.x < 800 && animal.y > 0 && animal.y < 820)
      if (animal.habitat === 'indoor') assert.ok(['cat', 'dog'].includes(animal.species), room.id)
      else {
        assert.ok(!['cat', 'dog'].includes(animal.species))
        assert.ok(animal.support, room.id)
      }
    }
    const cat = animals.find((a) => a.species === 'cat' && a.habitat === 'indoor')
    assert.deepEqual(
      getIndoorCatAnchor(room),
      cat ? { x: cat.x, y: cat.y, scale: cat.scale } : null,
      room.id,
    )
    assert.deepEqual(getSceneAnimals(room.id), animals)
  }
  assert.ok(empty > 0)
  assert.ok(species.size >= 10)
  assert.ok(
    new Set(
      BACKGROUNDS.filter((r) => r.category === 'forest').flatMap((r) =>
        getSceneAnimals(r).map((a) => a.species),
      ),
    ).size >= 5,
  )
})
