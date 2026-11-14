import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { Graphics, Point } from 'pixi.js'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { getSceneWorld } from '../src/pages/focus/model/sceneWorldCatalog.ts'
import {
  getSceneWorldJunction,
  SCENE_WORLD_JUNCTIONS,
  sideFloorAt,
} from '../src/pages/focus/model/sceneWorldJunctions.ts'
import { sceneWorldSideSurfaces } from '../src/pages/focus/lib/sceneWorldArchitecture.ts'
const window = new Window()
globalThis.document = window.document as unknown as Document
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
function paintAt(id: string, x: number, y: number): string | null {
  const svg = new window.DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${sceneWorldSideSurfaces(getSceneWorld(id))}</svg>`,
    'image/svg+xml',
  )
  for (const element of [...svg.querySelectorAll('path,rect,ellipse')].reverse()) {
    const graphics = new Graphics().svg(
      `<svg xmlns="http://www.w3.org/2000/svg">${element.outerHTML}</svg>`,
    )
    try {
      if (graphics.containsPoint(new Point(x + 900, y + 760))) return element.getAttribute('fill')
    } finally {
      graphics.destroy({ context: true })
    }
  }
  return null
}
test('all68 junctions register the real source borders and their outgoing tangents', () => {
  assert.deepEqual(
    Object.keys(SCENE_WORLD_JUNCTIONS).sort(),
    ALL_BACKGROUNDS.map((r) => r.id).sort(),
  )
  for (const room of ALL_BACKGROUNDS) {
    const j = getSceneWorldJunction(room.id)
    close(sideFloorAt(j, 0), j.floorLeft)
    close(sideFloorAt(j, 800), j.floorRight)
    close((sideFloorAt(j, -0.1) - sideFloorAt(j, 0)) / -0.1, j.slopeLeft)
    close((sideFloorAt(j, 800.1) - sideFloorAt(j, 800)) / 0.1, j.slopeRight)
    assert.ok([j.floorLeft, j.floorRight, j.slopeLeft, j.slopeRight].every(Number.isFinite))
  }
  const van = getSceneWorldJunction('travel-van')
  assert.deepEqual(
    [van.floorLeft, van.floorRight, van.slopeLeft, van.slopeRight],
    [658, 620, -38 / 800, -38 / 800],
  )
  const premium = getSceneWorldJunction('premium-memory-house')
  assert.deepEqual(
    [premium.floorLeft, premium.floorRight, premium.slopeLeft, premium.slopeRight],
    [590, 590, 0.0625, -0.0625],
  )
  assert.equal(getSceneWorldJunction('premium-onsen-veranda').floorLeft, 580)
})
test('side-only repairs preserve the entire original core and native world bounds', () => {
  for (const room of ALL_BACKGROUNDS) {
    const source = sceneWorldSideSurfaces(getSceneWorld(room.id))
    assert.doesNotMatch(source, /<image|<filter|gradient|transform=|NaN|Infinity/)
    const graphics = new Graphics().svg(`<svg xmlns="http://www.w3.org/2000/svg">${source}</svg>`)
    try {
      const b = graphics.getLocalBounds()
      assert.ok(b.minX >= 0 && b.minY >= 0 && b.maxX <= 2600 && b.maxY <= 2340, room.id)
      for (const x of [1, 200, 400, 600, 799])
        for (const y of [1, 300, 580, 650, 819])
          assert.equal(
            graphics.containsPoint(new Point(x + 900, y + 760)),
            false,
            `${room.id}: protected ${x},${y}`,
          )
      assert.ok(graphics.context.instructions.length < 200, `${room.id}: bounded side surfaces`)
    } finally {
      graphics.destroy({ context: true })
    }
  }
})
test('camper wall/floor material changes at its source slope, not a guessed perspective height', () => {
  assert.equal(paintAt('travel-van', -1, 640), '#2b342f')
  assert.equal(paintAt('travel-van', -1, 680), '#51584a')
  assert.equal(paintAt('travel-van', 801, 610), '#2b342f')
  assert.equal(paintAt('travel-van', 801, 640), '#51584a')
})
test('counter continues in front of fittings while lake water and rails keep their source heights', () => {
  const j = getSceneWorldJunction('cafe-rain')
  assert.ok(j.counter)
  const left = paintAt('cafe-rain', -1, 720),
    right = paintAt('cafe-rain', 801, 720)
  assert.equal(left, right, 'one countertop material plane at the same source Y')
  assert.notEqual(left, getSceneWorld('cafe-rain').edge.left)
  assert.equal(getSceneWorldJunction('water-lake').horizon?.y, 460)
  assert.deepEqual(getSceneWorldJunction('water-lake').rail?.courses, [574, 586])
  assert.equal(paintAt('water-lake', -1, 461), '#354d4b')
  assert.equal(paintAt('water-lake', -1, 574), paintAt('water-lake', 801, 574))
})
test('stone courses retain the authored sloping tile phase at both source borders', () => {
  const leftCourse = paintAt('water-stream', -1, 9)
  const leftBase = paintAt('water-stream', -1, 20)
  assert.notEqual(leftCourse, leftBase)
  assert.equal(paintAt('water-stream', -1, 4), leftBase, 'no invented horizontal course')
  assert.equal(paintAt('water-stream', 801, 2.5), leftCourse)
  assert.equal(paintAt('water-stream', 801, 9), leftBase)
})
test('dome upper background stays dark and its masonry returns on a curved vertical tangent', () => {
  const dark = paintAt('cafe-rain-dome', -1, 100)
  const masonry = paintAt('cafe-rain-dome', -1, 470)
  assert.notEqual(dark, masonry)
  assert.equal(paintAt('cafe-rain-dome', -100, 470), dark, 'outside the curved return remains dark')
  assert.equal(paintAt('cafe-rain-dome', 801, 100), dark)
  assert.equal(paintAt('cafe-rain-dome', 900, 470), dark)
})
test('dome stone ink is native translucent geometry above both dark and masonry surfaces', () => {
  assert.notEqual(paintAt('cafe-rain-dome', -1, 9), paintAt('cafe-rain-dome', -1, 20))
  const svg = new window.DOMParser().parseFromString(
    `<svg>${sceneWorldSideSurfaces(getSceneWorld('cafe-rain-dome'))}</svg>`,
    'image/svg+xml',
  )
  const ink = [...svg.querySelectorAll('[fill-opacity="0.22"]')]
  assert.equal(ink.length, 2, 'one native stone-ink layer per exterior side')
  for (const element of ink) {
    const graphics = new Graphics().svg(`<svg>${element.outerHTML}</svg>`)
    try {
      assert.ok(graphics.context.instructions.length > 0)
      for (const instruction of graphics.context.instructions) {
        assert.equal(instruction.action, 'fill')
        assert.equal(instruction.data.style.alpha, 0.22)
      }
    } finally {
      graphics.destroy({ context: true })
    }
  }
})
