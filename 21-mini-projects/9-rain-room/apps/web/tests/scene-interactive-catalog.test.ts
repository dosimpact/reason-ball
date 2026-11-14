import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { Window } from 'happy-dom'
import { Graphics, GraphicsContext } from 'pixi.js'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { STANDARD_SCENE_OBJECTS } from '../src/pages/focus/model/sceneInteractiveStandard.ts'
import { PREMIUM_SCENE_OBJECTS } from '../src/pages/focus/model/sceneInteractivePremium.ts'
import {
  SCENE_INTERACTIVE_OBJECTS,
  getSceneInteractiveObject,
  getSceneInteractiveObjects,
} from '../src/pages/focus/model/sceneInteractiveObjects.ts'
import { SceneObjectInteractionController } from '../src/pages/focus/model/sceneObjectInteraction.ts'
import { frameSceneWorld } from '../src/pages/focus/model/sceneWorldCamera.ts'
import {
  sceneInteractiveArtSvg,
  sceneInteractiveLayerSvg,
  sceneInteractiveObjectSvg,
} from '../src/pages/focus/lib/sceneInteractiveDrawing.ts'
import { projectSceneObjectTarget } from '../src/pages/focus/lib/pixiSceneInteractions.ts'

test('every room owns distinct discoveries and one to three large objects with stable identities', () => {
  assert.ok(SCENE_INTERACTIVE_OBJECTS.length >= 100)
  assert.equal(
    new Set(SCENE_INTERACTIVE_OBJECTS.map((o) => o.id)).size,
    SCENE_INTERACTIVE_OBJECTS.length,
  )
  const roomIds = new Set(ALL_BACKGROUNDS.map((room) => room.id))
  const artworks = new Set<string>()
  for (const object of SCENE_INTERACTIVE_OBJECTS) {
    assert.ok(roomIds.has(object.roomId), object.id)
    assert.ok(object.id.startsWith(`${object.roomId}:`), object.id)
    assert.equal(getSceneInteractiveObject(object.id), object)
    const digest = createHash('sha256')
      .update(object.art.base + object.art.subject)
      .digest('hex')
    assert.ok(!artworks.has(digest), `Identical copied artwork: ${object.id}`)
    artworks.add(digest)
  }
  for (const room of ALL_BACKGROUNDS) {
    const props = getSceneInteractiveObjects(room.id)
    assert.ok(props.length >= 2, room.id)
    const large = props.filter((object) => object.size === 'large')
    assert.ok(large.length >= 1 && large.length <= 3, `${room.id}: ${large.length} large props`)
    assert.ok(props.every((object) => object.roomId === room.id))
    assert.ok(Object.isFrozen(props))
  }
  assert.deepEqual(getSceneInteractiveObjects('not-a-room'), [])
  assert.equal(getSceneInteractiveObject('not-a-prop'), undefined)
})

test('catalog expansion preserves the original 136 collectible identities and authored details', () => {
  const original = [...STANDARD_SCENE_OBJECTS, ...PREMIUM_SCENE_OBJECTS]
  assert.equal(original.length, 136)
  assert.equal(
    createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    '127a1c6c79780dd6646316af8e868024d780ca09e24882c9a6eee2815a7dade6',
    'Published small discoveries retain their names, art, placement and identity during expansion',
  )
  for (const object of original) assert.equal(getSceneInteractiveObject(object.id), object)
})

test('catalog names, supports, finite reactions and local geometry are complete authoring inputs', () => {
  const kinds = new Set(['table', 'shelf', 'wall', 'window', 'ceiling', 'floor', 'water'])
  for (const object of SCENE_INTERACTIVE_OBJECTS) {
    for (const label of Object.values(object.label)) assert.ok(label.trim().length > 0, object.id)
    assert.ok(kinds.has(object.surface.kind) && object.surface.note.length > 10, object.id)
    assert.ok(
      Number.isFinite(object.scale) &&
        (object.size === 'large'
          ? object.scale >= 1.5 && object.scale <= 3
          : object.scale >= 0.45 && object.scale <= 1.3),
      object.id,
    )
    assert.ok(object.reaction.durationMs >= 500 && object.reaction.durationMs <= 4000, object.id)
    assert.match(object.reaction.color, /^#[0-9a-f]{6}$/i, object.id)
    assert.ok(object.reaction.description.length > 5, object.id)
    assert.ok(object.art.subject.length > 20, object.id)
    const art = object.art.base + object.art.subject
    assert.doesNotMatch(
      art,
      /<(?:image|text|filter|script|foreignObject|animate|animateTransform)\b|url\(|https?:|on(?:click|load|error)\s*=|<style\b/i,
      object.id,
    )
  }
})

test('all actual artwork compiles in the installed native SVG parser and stays inside its local box', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const dom = new Window()
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document })
  try {
    for (const object of SCENE_INTERACTIVE_OBJECTS) {
      const context = new GraphicsContext()
      const graphic = new Graphics(context)
      try {
        const svg = sceneInteractiveArtSvg(object.art.base + object.art.subject)
        // Open crank elbows otherwise acquire an unintended solid black triangle.
        const parsed = new dom.DOMParser().parseFromString(svg, 'image/svg+xml')
        for (const path of parsed.querySelectorAll('path[stroke]')) {
          let node: Element | null = path
          let fill: string | null = null
          while (node && fill === null) {
            fill = node.getAttribute('fill')
            node = node.parentElement
          }
          assert.notEqual(fill, null, `${object.id}: stroked paths need an explicit fill`)
        }
        context.svg(svg)
        assert.ok(context.instructions.length > 1, object.id)
        const b = graphic.getLocalBounds()
        assert.ok(b.width > 20 && b.height > 20, object.id)
        assert.ok(
          b.x >= -2 && b.y >= -2 && b.x + b.width <= 98 && b.y + b.height <= 98,
          `${object.id}: ${JSON.stringify(b)}`,
        )
        assert.ok(object.position.x + (b.x - 48) * object.scale >= 0, object.id)
        assert.ok(object.position.x + (b.x + b.width - 48) * object.scale <= 800, object.id)
        assert.ok(object.position.y + (b.y - 88) * object.scale >= 0, object.id)
        assert.ok(object.position.y + (b.y + b.height - 88) * object.scale <= 820, object.id)
        if (object.size === 'large') {
          assert.ok(Math.max(b.width, b.height) * object.scale >= 116, `${object.id}: visible size`)
          const target = object.interactionBounds
          assert.ok(target, `${object.id}: explicit silhouette bounds`)
          assert.ok(
            target.x <= b.x &&
              target.y <= b.y &&
              target.x + target.width >= b.x + b.width &&
              target.y + target.height >= b.y + b.height,
            `${object.id}: pointer bounds omit artwork`,
          )
        }
      } finally {
        graphic.destroy()
        context.destroy()
      }
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else Reflect.deleteProperty(globalThis, 'document')
    dom.happyDOM.abort()
  }
})

test('every authored prop stays idle, reacts independently to its own input, and settles exactly', () => {
  for (const room of ALL_BACKGROUNDS) {
    const objects = getSceneInteractiveObjects(room.id)
    const controller = new SceneObjectInteractionController(objects)
    const idle = sceneInteractiveLayerSvg(objects)
    controller.advance(60000)
    assert.equal(controller.activeCount, 0, room.id)
    for (const object of objects) {
      controller.clear()
      controller.activate(object.id)
      controller.advance(object.reaction.durationMs * 0.37)
      assert.notEqual(
        sceneInteractiveObjectSvg(object, controller.frame(object.id)),
        sceneInteractiveObjectSvg(object),
        object.id,
      )
      for (const other of objects)
        if (other.id !== object.id) assert.equal(controller.frame(other.id), undefined, other.id)
      controller.advance(10000)
      assert.equal(controller.activeCount, 0, object.id)
      assert.equal(sceneInteractiveLayerSvg(objects), idle, object.id)
    }
    controller.dispose()
  }
})

test('PC, phone and tablet projections retain usable, separate targets within the scene viewport', () => {
  for (const room of ALL_BACKGROUNDS) {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
      [320, 568],
    ]) {
      const frame = frameSceneWorld(width, height, room.id)
      const targets = getSceneInteractiveObjects(room.id).map((object) =>
        projectSceneObjectTarget(object, frame),
      )
      for (const target of targets) {
        assert.ok(target, `${room.id} ${width} target outside viewport`)
        assert.ok(target.width >= 44 && target.height >= 44, `${room.id} ${width} too small`)
        assert.ok(target.left >= 0 && target.top >= 0, room.id)
        assert.ok(
          target.left + target.width <= width && target.top + target.height <= height,
          room.id,
        )
      }
      for (let i = 0; i < targets.length; i++)
        for (let j = i + 1; j < targets.length; j++) {
          const a = targets[i]!,
            b = targets[j]!
          assert.ok(
            a.left + a.width <= b.left + 1e-8 ||
              b.left + b.width <= a.left + 1e-8 ||
              a.top + a.height <= b.top + 1e-8 ||
              b.top + b.height <= a.top + 1e-8,
            `${room.id} ${width}: ${a.id} overlaps ${b.id}`,
          )
        }
    }
  }
})
