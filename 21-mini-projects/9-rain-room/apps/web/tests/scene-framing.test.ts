import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { fitScene, coverScene } from '../src/pages/focus/model/pixiScene.ts'
const viewports = [
  [320, 480],
  [390, 664],
  [390, 844],
  [667, 375],
  [834, 1112],
  [1112, 834],
  [1440, 900],
  [1920, 1080],
] as const
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`)
test('all 68 authored manifests stay fully visible with uniform centered framing across device sizes', async () => {
  assert.equal(ALL_BACKGROUNDS.length, 68)
  for (const room of ALL_BACKGROUNDS) {
    const manifest = JSON.parse(
      await readFile(
        new URL(`../public/backgrounds/pixi/${room.id}/manifest.json`, import.meta.url),
        'utf8',
      ),
    )
    assert.equal(manifest.id, room.id)
    assert.equal(manifest.width, 800)
    assert.equal(manifest.height, 820)
    for (const [w, h] of viewports) {
      const f = fitScene(w, h, manifest.width, manifest.height)
      assert.ok(Object.values(f).every(Number.isFinite))
      assert.ok(f.scale > 0 && f.width > 0 && f.height > 0)
      assert.ok(f.x >= -1e-8 && f.y >= -1e-8, room.id)
      assert.ok(f.x + f.width <= w + 1e-8 && f.y + f.height <= h + 1e-8, room.id)
      near(f.width / manifest.width, f.height / manifest.height)
      near(f.width / f.height, manifest.width / manifest.height)
      near(2 * f.x + f.width, w)
      near(2 * f.y + f.height, h)
      assert.ok(Math.abs(f.width - w) < 1e-8 || Math.abs(f.height - h) < 1e-8)
      const old = coverScene(w, h)
      assert.ok(
        old.x < -1e-8 || old.y < -1e-8,
        'old cover crops at least one authored edge at these aspect ratios',
      )
    }
  }
})
test('rotation and physical DPR scaling preserve the same CSS-space authored geometry', () => {
  for (const [w, h] of viewports) {
    const f = fitScene(w, h)
    const rotated = fitScene(h, w)
    assert.ok(rotated.x >= 0 && rotated.y >= 0)
    near(rotated.width / rotated.height, 800 / 820)
    for (const dpr of [1, 1.5, 2, 3]) {
      const physical = fitScene(w * dpr, h * dpr)
      for (const key of ['x', 'y', 'width', 'height', 'scale'] as const)
        near(physical[key] / dpr, f[key])
    }
  }
  assert.deepEqual(fitScene(800, 820), { scale: 1, x: 0, y: 0, width: 800, height: 820 })
  assert.deepEqual(fitScene(100, 100, 200, 100), {
    scale: 0.5,
    x: 0,
    y: 25,
    width: 100,
    height: 50,
  })
})
test('non-positive and non-finite host or authored dimensions are rejected explicitly', () => {
  for (const bad of [0, -1, NaN, Infinity, -Infinity])
    for (const index of [0, 1, 2, 3]) {
      const dimensions = [390, 844, 800, 820]
      dimensions[index] = bad
      assert.throws(() => fitScene(...(dimensions as [number, number, number, number])), RangeError)
    }
})

test('expanded camera protects all 68 cores while every viewport stays inside the real authored world', async () => {
  const { frameSceneWorld } = await import('../src/pages/focus/model/sceneWorldCamera.ts')
  const { SCENE_WORLD_BOUNDS, getSceneWorld } = await import(
    '../src/pages/focus/model/sceneWorldCatalog.ts'
  )
  const world = SCENE_WORLD_BOUNDS
  for (const room of ALL_BACKGROUNDS) {
    assert.equal(getSceneWorld(room.id).id, room.id)
    for (const [w, h] of viewports) {
      const f = frameSceneWorld(w, h, room.id)
      assert.ok([f.x, f.y, f.width, f.height, f.scale].every(Number.isFinite), room.id)
      assert.ok(f.scale > 0)
      near(2 * f.x + f.width, w)
      near(2 * f.y + f.height, h)
      near(f.width / 800, f.scale)
      near(f.height / 820, f.scale)
      assert.ok(f.x >= -1e-8 && f.y >= -1e-8, `${room.id}: protected core origin`)
      assert.ok(
        f.x + f.width <= w + 1e-8 && f.y + f.height <= h + 1e-8,
        `${room.id}: protected core edges`,
      )
      const left = f.x + world.x * f.scale,
        top = f.y + world.y * f.scale
      assert.ok(left <= 1e-8 && top <= 1e-8, `${room.id}: world covers viewport origin`)
      assert.ok(
        left + world.width * f.scale >= w - 1e-8 && top + world.height * f.scale >= h - 1e-8,
        `${room.id}: world covers viewport edges`,
      )
      near(f.worldX, left)
      near(f.worldY, top)
      near(f.worldWidth, world.width * f.scale)
      near(f.worldHeight, world.height * f.scale)
      near(f.viewportWorld.x, -f.x / f.scale)
      near(f.viewportWorld.y, -f.y / f.scale)
      near(f.viewportWorld.width, w / f.scale)
      near(f.viewportWorld.height, h / f.scale)
      for (const dpr of [1, 2, 3]) {
        const physical = frameSceneWorld(w * dpr, h * dpr, room.id)
        for (const key of ['x', 'y', 'width', 'height', 'scale'] as const)
          near(physical[key] / dpr, f[key])
      }
      const rotated = frameSceneWorld(h, w, room.id)
      near(rotated.width / rotated.height, 800 / 820)
      assert.ok(rotated.x >= -1e-8 && rotated.y >= -1e-8)
      assert.ok(rotated.x + rotated.width <= h + 1e-8 && rotated.y + rotated.height <= w + 1e-8)
      near(2 * rotated.x + rotated.width, h)
      near(2 * rotated.y + rotated.height, w)
      assert.ok(rotated.worldX <= 1e-8 && rotated.worldY <= 1e-8)
      assert.ok(
        rotated.worldX + rotated.worldWidth >= h - 1e-8 &&
          rotated.worldY + rotated.worldHeight >= w - 1e-8,
      )
    }
  }
})

test('expanded camera rejects invalid sizes and covers unusual aspect ratios without exposing the world edge', async () => {
  const { frameSceneWorld } = await import('../src/pages/focus/model/sceneWorldCamera.ts')
  for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(() => frameSceneWorld(bad, 844), RangeError)
    assert.throws(() => frameSceneWorld(390, bad), RangeError)
  }
  for (const [width, height] of [
    [1, 10000],
    [10000, 1],
    [800, 820],
  ]) {
    const f = frameSceneWorld(width, height)
    assert.ok(f.worldX <= 1e-7 && f.worldY <= 1e-7)
    assert.ok(f.worldX + f.worldWidth >= width - 1e-7)
    assert.ok(f.worldY + f.worldHeight >= height - 1e-7)
  }
})
