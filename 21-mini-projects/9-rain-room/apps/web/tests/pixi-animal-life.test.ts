import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import * as Pixi from 'pixi.js'
import { getAnimalHabitat } from '../src/pages/focus/model/animalHabitats.ts'
import { createPixiAnimalLife } from '../src/pages/focus/lib/pixiAnimalLife.ts'
test('actual native rig contexts are parsed once, interpolated without regeneration, and destroyed once', () => {
  const dom = new Window(),
    previous = globalThis.document
  globalThis.document = dom.document as unknown as Document
  let parsed = 0,
    destroyed = 0
  class Context extends Pixi.GraphicsContext {
    svg(svg: string) {
      parsed++
      return super.svg(svg)
    }
    destroy() {
      destroyed++
      super.destroy()
    }
  }
  const pixi = { ...Pixi, GraphicsContext: Context } as typeof Pixi
  try {
    const plan = getAnimalHabitat('cafe-rain')
    const life = createPixiAnimalLife({ plan, pixi, seed: 9 })
    const initialParsed = parsed
    assert.ok(parsed > 0)
    const stations = plan.actors.flatMap((actor) =>
      life.getNode(actor.id)!.children.filter((node) => node instanceof Pixi.Graphics),
    ) as Pixi.Graphics[]
    assert.ok(stations.length > 0, 'food is visible native geometry, not an invisible destination')
    const stationInstructions = stations.map((node) => node.context.instructions)
    assert.ok(stationInstructions.every((instructions) => instructions.length > 0))
    for (let i = 0; i < 150; i++) life.update(1 / 30)
    assert.equal(parsed, initialParsed)
    stations.forEach((node, index) =>
      assert.equal(
        node.context.instructions,
        stationInstructions[index],
        'world food geometry stays fixed',
      ),
    )
    assert.ok(life.snapshot().every((state) => state.time > 4))
    for (const actor of plan.actors) {
      const node = life.getNode(actor.id)!
      assert.ok(Number.isFinite(node.position.x) && Number.isFinite(node.position.y))
      assert.ok(node.children.every((part) => Number.isFinite(part.rotation)))
    }
    life.destroy()
    life.destroy()
    life.update(1000)
    assert.equal(destroyed, parsed)
    assert.equal(life.getNode(plan.actors[0]!.id), undefined)
  } finally {
    globalThis.document = previous
    void dom.happyDOM.abort()
  }
})
test('partially parsed native anatomy cannot leak contexts or start after failed construction', () => {
  const dom = new Window(),
    previous = globalThis.document
  globalThis.document = dom.document as unknown as Document
  let destroyed = 0
  class Context extends Pixi.GraphicsContext {
    svg() {
      throw Error('parse failed')
    }
    destroy() {
      destroyed++
      super.destroy()
    }
  }
  try {
    assert.throws(() =>
      createPixiAnimalLife({
        plan: getAnimalHabitat('cafe-rain'),
        pixi: { ...Pixi, GraphicsContext: Context } as typeof Pixi,
      }),
    )
    assert.equal(destroyed, 1)
  } finally {
    globalThis.document = previous
    void dom.happyDOM.abort()
  }
})

test('native spider tether and food stations stay world-fixed while parts animate without parser churn', () => {
  const dom = new Window(),
    previous = globalThis.document
  globalThis.document = dom.document as unknown as Document
  let created = 0,
    parsed = 0,
    destroyed = 0
  class Context extends Pixi.GraphicsContext {
    constructor() {
      super()
      created++
    }
    svg(svg: string) {
      parsed++
      return super.svg(svg)
    }
    destroy() {
      destroyed++
      super.destroy()
    }
  }
  try {
    const plan = getAnimalHabitat('premium-halloween-greenhouse')
    // Select the authored thread creature from whichever premium room owns it.
    const actor = plan.actors.find((actor) => actor.species === 'spider')
    if (!actor) throw Error('expected authored Halloween spider')
    const life = createPixiAnimalLife({
      plan: { ...plan, actors: [actor] },
      pixi: { ...Pixi, GraphicsContext: Context } as typeof Pixi,
    })
    const initialParsed = parsed
    const slot = life.getNode(actor.id)!
    assert.ok(
      slot.children.some(
        (node) =>
          node instanceof Pixi.Graphics &&
          node.context.instructions.some(
            (item) => item.action === 'stroke' && item.data.style.width === 1.2,
          ),
      ),
      'thread is a native world-coordinate line',
    )
    for (let i = 0; i < 90; i++) life.update(1 / 30)
    assert.equal(parsed, initialParsed)
    life.destroy()
    assert.equal(destroyed, created)
  } finally {
    globalThis.document = previous
    void dom.happyDOM.abort()
  }
})

test('every canonical room animal and resource constructs real native geometry with bounded parser lifetime', async () => {
  const { ALL_BACKGROUNDS } = await import('../src/pages/focus/model/backgrounds.ts')
  const dom = new Window(),
    previous = globalThis.document
  globalThis.document = dom.document as unknown as Document
  let created = 0,
    parsed = 0,
    destroyed = 0,
    count = 0
  class Context extends Pixi.GraphicsContext {
    constructor() {
      super()
      created++
    }
    svg(svg: string) {
      parsed++
      return super.svg(svg)
    }
    destroy() {
      destroyed++
      super.destroy()
    }
  }
  try {
    for (const room of ALL_BACKGROUNDS) {
      const plan = getAnimalHabitat(room.id)
      const life = createPixiAnimalLife({
        plan,
        pixi: { ...Pixi, GraphicsContext: Context } as typeof Pixi,
        seed: 19,
      })
      const initialParsed = parsed
      for (let i = 0; i < 30; i++) life.update(1 / 30)
      for (const actor of plan.actors) {
        const node = life.getNode(actor.id)!
        assert.ok(node, `${room.id}/${actor.id}`)
        const bounds = node.getBounds()
        assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite))
        assert.ok(bounds.width > 0 && bounds.height > 0, `${actor.id}: actual drawable geometry`)
        count++
      }
      assert.equal(parsed, initialParsed, `${room.id}: no SVG parsing during animation`)
      life.destroy()
      assert.equal(destroyed, created, `${room.id}: all owned native contexts released`)
    }
    assert.equal(
      count,
      ALL_BACKGROUNDS.reduce((n, room) => n + getAnimalHabitat(room.id).actors.length, 0),
    )
  } finally {
    globalThis.document = previous
    await dom.happyDOM.abort()
  }
})
