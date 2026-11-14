import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKGROUND_CATEGORIES, BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import {
  getSceneSeats,
  getCharacterAppearance,
  getSeatGeometry,
} from '../src/pages/focus/model/sceneCast.ts'

test('populated rooms have stable individual cast profiles while solo rooms remain empty', () => {
  const ids = new Set<string>()
  const profiles = new Set<string>()
  const garments = new Set<string>()
  const haircuts = new Set<string>()
  for (const background of BACKGROUNDS) {
    const seats = getSceneSeats(background)
    if (!background.companions) assert.equal(seats.length, 0)
    for (const [index, seat] of seats.entries()) {
      const person = getCharacterAppearance(background.scene, index)
      assert.ok(!ids.has(person.id), person.id)
      ids.add(person.id)
      const { id, ...appearance } = person
      void id
      assert.ok(!profiles.has(JSON.stringify(appearance)), person.id)
      profiles.add(JSON.stringify(appearance))
      garments.add(person.outfit)
      haircuts.add(person.hair)
      assert.deepEqual(getCharacterAppearance(background.scene, index), person)
      assert.ok(getSeatGeometry(background, seat).scale > 0)
    }
  }
  assert.ok(ids.size >= 40)
  assert.ok(garments.size >= 8)
  assert.ok(haircuts.size >= 9)
  assert.equal(BACKGROUND_CATEGORIES.length, 6)
})
test('back views never display facial age marks', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { fileURLToPath } = await import('node:url')
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { CharacterHead } = await server.ssrLoadModule('/src/pages/focus/ui/SceneCompanions.tsx')
    const person = { ...getCharacterAppearance(0, 0), accessory: 'none', age: 'mature' }
    const html = renderToStaticMarkup(
      createElement(CharacterHead, {
        view: 'back',
        gaze: 'forward',
        expression: 'focused',
        hair: person.hair,
        skin: person.skin,
        hairColor: person.hairColor,
        appearance: person,
      }),
    )
    assert.ok(html.includes('data-head-view="back"'))
    assert.ok(!html.includes('data-face-feature'))
    assert.ok(!html.includes('<rect'))
  } finally {
    await server.close()
  }
})

test('peaceful, focused, thoughtful and sleepy faces use distinguishable eye, brow and mouth shapes', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { CharacterHead } = await server.ssrLoadModule('/src/pages/focus/ui/SceneCompanions.tsx')
    const shapes = new Set<string>()
    for (const expression of ['calm', 'focused', 'thoughtful', 'sleepy']) {
      const html = renderToStaticMarkup(
        createElement(CharacterHead, {
          view: 'front',
          gaze: expression === 'focused' ? 'down' : 'forward',
          expression,
          hair: 'short',
          skin: '#c4a58a',
          hairColor: '#514237',
        }),
      )
      assert.ok(html.includes(`data-face-expression="${expression}"`))
      assert.ok(html.includes('data-face-feature="brows"'))
      assert.ok(html.includes('data-face-feature="mouth"'))
      shapes.add(html.replace(/data-face-expression="[^"]+"/, ''))
    }
    assert.equal(shapes.size, 4)
  } finally {
    await server.close()
  }
})

test('all ordinary people retain complete identity groups, necks and activity contacts for whole-person raster rendering', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { Window } = await import('happy-dom')
  const server = await createServer({
      server: { middlewareMode: true, watch: null, hmr: false },
      appType: 'custom',
    }),
    window = new Window()
  const ids = new Set<string>()
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    for (const room of BACKGROUNDS) {
      window.document.body.innerHTML = renderToStaticMarkup(
        createElement(Cafe, { backgroundId: room.id, artOnly: true, paused: true }),
      )
      const people = [...window.document.querySelectorAll<HTMLElement>('[data-character]')]
      assert.equal(people.length, room.companions, `${room.id} keeps every authored person`)
      for (const person of people) {
        const id = person.getAttribute('data-character')!
        assert.ok(!ids.has(id), id)
        ids.add(id)
        assert.ok(person.querySelector('[data-joint="neck"]'), `${id} has connected neck`)
        if (person.dataset.pose === 'barista') {
          assert.ok(person.querySelector('[data-contact="pot-handle"]'))
          assert.ok(person.querySelector('[data-contact="pot-body"]'))
        } else if (person.dataset.view !== 'back')
          assert.ok(
            person.querySelector('[data-contact]'),
            `${id} keeps a visible hand-to-prop contact`,
          )
      }
    }
    assert.equal(ids.size, 43)
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})
