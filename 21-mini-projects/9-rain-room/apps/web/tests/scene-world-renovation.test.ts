import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { getSceneWorld, type SceneWorld } from '../src/pages/focus/model/sceneWorldCatalog.ts'
import { renovatedWorldContent } from '../src/pages/focus/lib/sceneWorldArchitecture.ts'

function drawing(world: SceneWorld) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="2600" height="2340" viewBox="0 0 2600 2340">${renovatedWorldContent({ world, plan: world.renovation, edge: world.edge }, 'underlay')}</svg>`,
  )
}

test('a lamp wire cannot relocate the room ceiling or its fitted panels', async () => {
  const original = getSceneWorld('garden-hanok')
  const plain = { ...original, edge: { ...original.edge, upperFrames: [] } }
  const wired = {
    ...original,
    edge: { ...original.edge, upperFrames: [{ x: 399, width: 3, color: '#202620' }] },
  }
  const region = { left: 1000, top: 510, width: 600, height: 210 }
  const render = (world: SceneWorld) =>
    sharp(drawing(world)).extract(region).ensureAlpha().raw().toBuffer()
  const [a, b] = await Promise.all([render(plain), render(wired)])
  // A real wire may add its own narrow pixels. Every other ceiling/panel pixel must stay put.
  for (let y = 0; y < region.height; y++)
    for (let x = 0; x < region.width; x++) {
      if (x >= 290 && x <= 310) continue
      const offset = (y * region.width + x) * 4
      assert.equal(a.readUInt32LE(offset), b.readUInt32LE(offset), `ceiling shifted at ${x},${y}`)
    }
})

test('open terrace side sky is independent of the colors of its edge posts', async () => {
  for (const id of ['water-lake', 'premium-rooftop-cinema']) {
    const original = getSceneWorld(id)
    const altered = { ...original, edge: { ...original.edge, left: '#ff0000', right: '#00ff00' } }
    const pixel = (world: SceneWorld) =>
      sharp(drawing(world))
        .extract({ left: 820, top: 860, width: 1, height: 1 })
        .ensureAlpha()
        .raw()
        .toBuffer()
    const [a, b] = await Promise.all([pixel(original), pixel(altered)])
    assert.deepEqual(a, b, `${id}: a sampled post must not become a solid outdoor wall`)
  }
})
