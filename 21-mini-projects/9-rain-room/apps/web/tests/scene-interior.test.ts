import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import {
  SCENE_INTERIORS,
  getSceneInterior,
  validateSceneInteriors,
} from '../src/pages/focus/model/sceneInterior.ts'
import { getSceneArchitecture } from '../src/pages/focus/model/sceneArchitecture.ts'
import { SCENE_EFFECTS } from '../src/pages/focus/model/sceneEffects.ts'
import { getIndoorCatAnchor } from '../src/pages/focus/model/sceneAnimals.ts'
test('authored room interiors cover every space with distinct fixture, wall and table families', () => {
  assert.deepEqual(validateSceneInteriors(), [])
  assert.equal(Object.keys(SCENE_INTERIORS).length, BACKGROUNDS.length)
  const interiors = Object.values(SCENE_INTERIORS)
  assert.equal(
    new Set(interiors.flatMap((room) => room.lights.map((light) => light.kind))).size,
    14,
  )
  assert.equal(new Set(interiors.map((room) => room.wall.material)).size, 10)
  assert.equal(new Set(interiors.map((room) => room.table.shape)).size, 9)
  assert.ok(
    new Set(
      interiors.map((room) =>
        room.lights.map((light) => `${light.kind}:${light.x},${light.y}`).join('|'),
      ),
    ).size >= 25,
  )
  for (const room of BACKGROUNDS) {
    const interior = getSceneInterior(room.id)
    for (const glow of SCENE_EFFECTS[room.id].lamps)
      assert.ok(
        interior.lights.some((light) => light.x === glow.x && light.y === glow.y),
        `${room.id}: glow follows a real fixture`,
      )
    const cat = getIndoorCatAnchor(room)
    assert.equal(Boolean(SCENE_EFFECTS[room.id].cat), Boolean(cat))
    if (cat) assert.equal(SCENE_EFFECTS[room.id].cat!.scale, cat.scale)
    for (const light of interior.lights)
      if (light.kind === 'desk' && !room.companions)
        assert.ok(
          (light.reach ?? light.x) < 310,
          'solo desk lamps stay left of the open book and mug',
        )
  }
  const terraces = interiors.filter((room) => room.enclosure === 'terrace')
  assert.deepEqual(
    terraces.map((room) => room.id),
    ['water-moon', 'water-lake', 'water-velvet-tide'],
  )
  for (const room of terraces) {
    const background = BACKGROUNDS.find((background) => background.id === room.id)!
    assert.equal(getSceneArchitecture(background.scene).kind, 'terrace')
    assert.equal(getSceneArchitecture(background.scene).frames, '')
    assert.ok(!SCENE_EFFECTS[room.id].details.some((detail) => detail.kind === 'droplets'))
    assert.match(background.name, /테라스|포치/)
  }
})
test('shared and solo table contact heights stay stable and the terrace cat renders once in front of its chair', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { Window } = await import('happy-dom')
  const window = new Window()
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    for (const room of BACKGROUNDS.filter((room) => ![0, 35, 36].includes(room.scene))) {
      window.document.body.innerHTML = renderToStaticMarkup(
        createElement(Cafe, { backgroundId: room.id }),
      )
      const document = window.document
      assert.equal(
        document.querySelector('[data-contact-y]')?.getAttribute('data-contact-y'),
        String(room.companions ? 608 : 660),
        room.id,
      )
      assert.equal(
        document.querySelectorAll('[data-light-kind]').length,
        getSceneInterior(room.id).lights.length,
        room.id,
      )
      if (room.scene === 34) {
        assert.equal(document.querySelectorAll('[data-pet="cat"]').length, 1)
        const svg = document.querySelector('[data-testid="cafe-scene"]>svg')!
        const chair = [...svg.querySelectorAll('*')].findIndex(
          (node) => node.getAttribute('data-song-furnishing') === 'velvet-armchair',
        )
        const pets = [...svg.querySelectorAll('*')].findIndex((node) =>
          node.classList.contains('scene-pets'),
        )
        assert.ok(chair >= 0 && pets > chair, 'chair is behind the single configured pet')
      }
    }
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})
