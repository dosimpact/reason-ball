import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { Window } from 'happy-dom'
import { Graphics, Point } from 'pixi.js'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import {
  SCENE_WORLDS,
  SCENE_WORLD_BOUNDS,
  getSceneWorld,
} from '../src/pages/focus/model/sceneWorldCatalog.ts'
import { sceneWorldSvg } from '../src/pages/focus/lib/sceneWorldArt.ts'
import { SCENE_SIDE_FITTINGS } from '../src/pages/focus/model/sceneSideFittings.ts'
import { sceneWorldFittings } from '../src/pages/focus/lib/sceneWorldFittings.ts'
const window = new Window()
globalThis.document = window.document as unknown as Document

test('every canonical room has a deliberately authored extended world and preserved source bounds', () => {
  assert.deepEqual(Object.keys(SCENE_WORLDS).sort(), ALL_BACKGROUNDS.map((r) => r.id).sort())
  assert.deepEqual(SCENE_WORLD_BOUNDS, { x: -900, y: -760, width: 2600, height: 2340 })
  for (const room of ALL_BACKGROUNDS) {
    const config = getSceneWorld(room.id)
    assert.equal(config.id, room.id)
    assert.equal(config.bounds, SCENE_WORLD_BOUNDS)
    for (const color of [config.wall, config.floor, config.trim])
      assert.match(color, /^#[0-9a-f]{6}$/i)
    assert.ok(config.detail && config.renovation.rationale.length > 50)
    const plan = config.renovation
    assert.ok(plan.upperX >= 0 && plan.upperX <= 800)
    assert.ok(plan.lowerX >= 0 && plan.lowerX <= 800)
    assert.ok(plan.roofRise >= 0 && plan.roofRise <= 650)
    assert.ok(Number.isFinite(plan.vanishing.x) && Number.isFinite(plan.vanishing.y))
    for (const color of Object.values(config.edge).filter((value) => typeof value === 'string'))
      assert.match(color, /^#[0-9a-f]{6}$/i)
  }
  assert.equal(getSceneWorld('../unsafe').id, 'cafe-rain')
  assert.equal(new Set(Object.values(SCENE_WORLDS).map((c) => c.detail)).size, 68)
  assert.ok(new Set(Object.values(SCENE_WORLDS).map((c) => c.renovation.envelope)).size >= 10)
  assert.ok(new Set(Object.values(SCENE_WORLDS).map((c) => c.renovation.foreground)).size >= 8)
  for (const id of ['water-moon', 'water-lake', 'water-velvet-tide'])
    assert.equal(getSceneWorld(id).open, true)
})

test('all 68 underlays parse into bounded native geometry, without textures or transform assumptions', () => {
  const signatures = new Set<string>()
  for (const room of ALL_BACKGROUNDS) {
    const source = sceneWorldSvg(room.id)
    assert.doesNotMatch(
      source,
      /<image|<filter|<foreignObject|<text\b|<linearGradient|<radialGradient|transform=|url\(|NaN|Infinity|href=/i,
    )
    const svg = new window.DOMParser().parseFromString(source, 'image/svg+xml')
    assert.equal(svg.documentElement.getAttribute('viewBox'), '0 0 2600 2340')
    for (const leaf of svg.querySelectorAll('path,rect,ellipse')) {
      assert.ok(leaf.hasAttribute('fill'))
      assert.equal(leaf.getAttribute('stroke'), 'none')
      for (const name of ['x', 'y', 'width', 'height', 'cx', 'cy', 'rx', 'ry'])
        if (leaf.hasAttribute(name)) assert.ok(Number.isFinite(Number(leaf.getAttribute(name))))
    }
    const graphics = new Graphics().svg(source)
    try {
      const b = graphics.getLocalBounds()
      assert.deepEqual([b.minX, b.minY, b.maxX, b.maxY], [0, 0, 2600, 2340], room.id)
      assert.ok(
        graphics.context.instructions.length > 15,
        `${room.id}: real surrounding architecture; open views need fewer parts than enclosed rooms`,
      )
      assert.ok(graphics.context.instructions.length < 350, `${room.id}: bounded primitive budget`)
      assert.equal(graphics.containsPoint(new Point(2, 2)), true)
      assert.equal(graphics.containsPoint(new Point(2598, 2338)), true)
      for (const instruction of graphics.context.instructions)
        assert.equal(
          instruction.data.style.texture.label,
          'WHITE',
          'native filled primitive, not SVG texture',
        )
      signatures.add(
        createHash('sha256')
          .update([...svg.querySelectorAll('path,rect,ellipse')].map((el) => el.outerHTML).join(''))
          .digest('hex'),
      )
    } finally {
      graphics.destroy({ context: true })
    }
  }
  assert.equal(signatures.size, 68, 'each room has a distinct authored material/structure drawing')
})

test('joinery stays narrow and never paints over the core people, table or central aperture', () => {
  for (const room of ALL_BACKGROUNDS) {
    const graphics = new Graphics().svg(sceneWorldSvg(room.id, 'joinery'))
    try {
      const b = graphics.getLocalBounds()
      assert.ok(b.minX >= 0 && b.minY >= 0 && b.maxX <= 2600 && b.maxY <= 2340)
      // Probe in baked coordinates, original core lives at x900..1700,y760..1580.
      for (const [x, y] of [
        [400, 400],
        [200, 600],
        [600, 600],
        [400, 810],
        [30, 300],
        [770, 300],
      ])
        assert.equal(
          graphics.containsPoint(new Point(x + 900, y + 760)),
          false,
          `${room.id}: protected core ${x},${y}`,
        )
    } finally {
      graphics.destroy({ context: true })
    }
  }
})

test('desktop side bays are authored for every room and never intrude on the original composition', () => {
  assert.deepEqual(
    Object.keys(SCENE_SIDE_FITTINGS).sort(),
    ALL_BACKGROUNDS.map((room) => room.id).sort(),
  )
  for (const room of ALL_BACKGROUNDS) {
    const content = sceneWorldFittings(getSceneWorld(room.id))
    const graphics = new Graphics().svg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="2600" height="2340">${content}</svg>`,
    )
    try {
      assert.ok(graphics.context.instructions.length > 0, `${room.id}: visible attached fixtures`)
      assert.ok(graphics.context.instructions.length < 100, `${room.id}: bounded side geometry`)
      for (const x of [0, 200, 400, 600, 800])
        for (const y of [0, 200, 400, 600, 820])
          assert.equal(
            graphics.containsPoint(new Point(x + 900, y + 760)),
            false,
            `${room.id}: protected core`,
          )
    } finally {
      graphics.destroy({ context: true })
    }
  }
})
