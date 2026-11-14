import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getSceneWeather } from '../src/pages/focus/model/sceneWeather.ts'
import { getSceneAnimals } from '../src/pages/focus/model/sceneAnimals.ts'
import { getSceneInterior } from '../src/pages/focus/model/sceneInterior.ts'
import {
  BACKGROUND_CATEGORIES,
  BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  getBackground,
} from '../src/pages/focus/model/backgrounds.ts'

// Editorial changes are limited to approved terrace/autumn rooms; identity, category and cast stay fixed.
const EDITED_ROOM_COPY = new Set([
  'water-moon',
  'water-lake',
  'water-velvet-tide',
  'cafe-alley',
  'study-linen',
  'forest-autumn',
  'travel-train',
  'travel-van',
  'garden-hanok',
  'garden-court',
])
function withApprovedRoomCopy(original: typeof BACKGROUNDS) {
  return original.map((room) =>
    EDITED_ROOM_COPY.has(room.id)
      ? {
          ...room,
          name: BACKGROUNDS[room.scene].name,
          description: BACKGROUNDS[room.scene].description,
        }
      : room,
  )
}

test('background catalog offers thirty-eight distinct spaces across six categories while preserving original scene indices', () => {
  assert.equal(BACKGROUNDS.length, 38)
  assert.equal(new Set(BACKGROUNDS.map((item) => item.id)).size, 38)
  assert.equal(new Set(BACKGROUNDS.map((item) => item.name)).size, 38)
  assert.equal(BACKGROUND_CATEGORIES.length, 6)
  const counts = { cafe: 8, study: 7, forest: 6, water: 7, travel: 5, garden: 5 }
  for (const category of BACKGROUND_CATEGORIES)
    assert.equal(
      BACKGROUNDS.filter((item) => item.category === category.id).length,
      counts[category.id],
    )
  for (const [index, background] of BACKGROUNDS.slice(0, 30).entries())
    assert.equal(background.scene, index)
  assert.deepEqual(
    BACKGROUNDS.slice(30, 35).map((background) => background.scene),
    [30, 31, 32, 33, 34],
  )
  for (const background of BACKGROUNDS) {
    assert.ok(background.description.length > 10)
    assert.match(background.description, /비|빗/)
    assert.ok(background.companions >= 0 && background.companions <= 3)
    assert.equal(getBackground(background.id), background)
  }
})
test('cozy shared-focus scenes include people in every cafe and selected communal rooms', () => {
  const cafes = BACKGROUNDS.filter((item) => item.category === 'cafe')
  assert.ok(cafes.every((item) => item.companions >= 2))
  const shared = BACKGROUNDS.filter((item) => item.companions > 0)
  assert.ok(shared.length >= 12)
  for (const id of [
    'study-library',
    'study-city',
    'travel-train',
    'travel-lodge',
    'garden-glass',
  ]) {
    assert.ok(getBackground(id).companions > 0, id)
  }
})
test('missing and obsolete saved background selections recover to the rainy cafe', () => {
  for (const id of [undefined, '', 'obsolete-background', '__proto__'])
    assert.equal(getBackground(id).id, DEFAULT_BACKGROUND_ID)
})

test('every main scene has its assigned weather and picker previews keep precipitation static', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    for (const background of BACKGROUNDS) {
      for (const thumbnail of [false, true]) {
        const markup = renderToStaticMarkup(
          createElement(Cafe, { backgroundId: background.id, thumbnail }),
        )
        assert.equal((markup.match(/data-testid="rain-overlay"/g) ?? []).length, 1, background.id)
        assert.equal(
          (markup.match(/data-testid="scene-effects"/g) ?? []).length,
          thumbnail ? 0 : 1,
          background.id,
        )
        assert.ok(markup.includes(`data-static="${thumbnail}"`), background.id)
        assert.ok(
          markup.includes(`data-weather="${getSceneWeather(background.id)}"`),
          background.id,
        )
        assert.ok(markup.includes('clip-path='), background.id)
        assert.ok(markup.includes('mask='), background.id)
        assert.equal(
          markup.includes('class="scene-clock"'),
          !thumbnail,
          `${background.id}: clocks belong to main scenes only`,
        )
        assert.ok(
          markup.includes(`data-presence="${background.companions ? 'shared' : 'solo'}"`),
          background.id,
        )
        if (background.companions) assert.ok(markup.includes('focus-companions'), background.id)
        assert.ok(
          !markup.includes('class="rain-layer"'),
          `${background.id} must not duplicate animated rain`,
        )
      }
    }
  } finally {
    await server.close()
  }
})

test('shared rooms stage different activities with facing conversation partners and retain solo rooms', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    const poses = new Set<string>()
    const combinations = new Set<string>()
    for (const background of BACKGROUNDS) {
      const markup = renderToStaticMarkup(
        createElement(Cafe, { backgroundId: background.id, thumbnail: true }),
      )
      const people = [...markup.matchAll(/data-pose="([^"]+)"/g)].map((match) => match[1])
      assert.equal(people.length, background.companions, background.id)
      people.forEach((pose) => poses.add(pose))
      if (people.length) combinations.add(people.join(','))
      if (people.includes('conversation')) {
        assert.equal(people.filter((pose) => pose === 'conversation').length, 2, background.id)
        assert.match(markup, /data-conversation-role="speaker" data-facing="1"/)
        assert.match(markup, /data-conversation-role="listener" data-facing="-1"/)
      }
    }
    for (const pose of ['reading', 'laptop', 'coffee', 'conversation', 'writing'])
      assert.ok(poses.has(pose), pose)
    assert.ok(combinations.size >= 8, 'rooms should offer a variety of staged activities')
  } finally {
    await server.close()
  }
})

test('indoor scenes include quiet resting pets with both a cat and dog in the default cafe', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    const observedPoses = new Set<string>()
    for (const background of BACKGROUNDS) {
      const markup = renderToStaticMarkup(
        createElement(Cafe, { backgroundId: background.id, thumbnail: true }),
      )
      const pets = [...markup.matchAll(/data-pet="([^"]+)" data-pet-pose="([^"]+)"/g)]
      assert.equal(
        pets.length,
        getSceneAnimals(background).filter((animal) => animal.habitat === 'indoor').length,
        `${background.id}: only configured indoor companions render as pets`,
      )
      assert.equal(new Set(pets.map((match) => match[1])).size, pets.length)
      pets.forEach((match) => observedPoses.add(match[2]))
      if (background.id === DEFAULT_BACKGROUND_ID)
        assert.deepEqual(pets.map((match) => match[1]).sort(), ['cat', 'dog'])
      assert.equal(
        (markup.match(/data-pose="/g) ?? []).length,
        background.companions,
        'adding pets must not change the human cast',
      )
    }
    assert.deepEqual([...observedPoses].sort(), ['curled', 'loaf', 'resting-on-mat', 'stretched'])
  } finally {
    await server.close()
  }
})

test('character views render distinct facial geometry and rear-facing bodies never expose front facial features', async () => {
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
    const views = new Set<string>()
    const hair = new Set<string>()
    const expressions = new Set<string>()
    let backCount = 0
    for (const background of BACKGROUNDS) {
      window.document.body.innerHTML = renderToStaticMarkup(
        createElement(Cafe, { backgroundId: background.id, thumbnail: true }),
      )
      const people = [...window.document.querySelectorAll('g[data-pose]')]
      assert.equal(people.length, background.companions, background.id)
      for (const person of people) {
        const view = person.getAttribute('data-view')!
        views.add(view)
        hair.add(person.getAttribute('data-hair')!)
        expressions.add(person.getAttribute('data-expression')!)
        const eyes = person.querySelectorAll('[data-eye]')
        if (view === 'front') assert.equal(eyes.length, 2, 'front-facing faces need both eyes')
        if (view === 'profile')
          assert.equal(eyes.length, 1, 'a side profile must not reuse the front face')
        if (view === 'back') {
          backCount++
          assert.equal(eyes.length, 0)
          assert.equal(
            person.querySelectorAll('[data-face-feature]').length,
            0,
            'rear heads must not show eyes, nose or mouth',
          )
          assert.ok(
            person.querySelector('[data-depth="chair-in-front"]'),
            'the rear chair must occlude the back, not sit behind a front-facing torso',
          )
        }
        if (
          view !== 'back' &&
          person.getAttribute('data-gaze') === 'down' &&
          person.getAttribute('data-expression') === 'focused'
        ) {
          assert.ok(
            person.querySelector('[data-face-feature="downward-pupils"]'),
            'focused reading should have visible downward pupils, not closed sleeping eyes',
          )
        }
      }
      if (background.id === DEFAULT_BACKGROUND_ID)
        assert.deepEqual(
          people.map((person) => person.getAttribute('data-view')),
          ['front', 'profile'],
        )
    }
    assert.deepEqual([...views].sort(), ['back', 'front', 'profile', 'three-quarter'])
    assert.ok(
      backCount >= 5,
      'rear views should recur across rooms rather than exist only in a showcase',
    )
    assert.ok(hair.size >= 3)
    assert.ok(expressions.size >= 3)
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})

test('scene caption time uses a two-digit local twelve-hour clock at midnight, morning and noon', async () => {
  const { formatSceneTime } = await import('../src/pages/focus/lib/sceneTime.ts')
  assert.equal(formatSceneTime(new Date(2026, 10, 11, 0, 0)), '12:00 AM')
  assert.equal(formatSceneTime(new Date(2026, 10, 11, 9, 5)), '09:05 AM')
  assert.equal(formatSceneTime(new Date(2026, 10, 11, 12, 0)), '12:00 PM')
  assert.equal(formatSceneTime(new Date(2026, 10, 11, 23, 9)), '11:09 PM')
})

test('adding song-inspired rooms preserves every original room and appends unique scene IDs', () => {
  const original = JSON.parse(
    readFileSync(new URL('./fixtures/original-backgrounds.json', import.meta.url), 'utf8'),
  )
  assert.deepEqual(BACKGROUNDS.slice(0, 30), withApprovedRoomCopy(original))
  assert.deepEqual(
    BACKGROUNDS.slice(30, 35).map(({ id, category, companions, scene }) => ({
      id,
      category,
      companions,
      scene,
    })),
    [
      { id: 'study-linen', category: 'study', companions: 1, scene: 30 },
      { id: 'forest-pine-fireflies', category: 'forest', companions: 2, scene: 31 },
      { id: 'study-granite', category: 'study', companions: 1, scene: 32 },
      { id: 'water-harbor-deep', category: 'water', companions: 2, scene: 33 },
      { id: 'water-velvet-tide', category: 'water', companions: 0, scene: 34 },
    ],
  )
  assert.equal(new Set(BACKGROUNDS.map((room) => room.scene)).size, 38)
})

test('new communal cafes retain the prior thirty-five rooms and provide distinct sheltered geometry', async () => {
  const prior = JSON.parse(
    readFileSync(new URL('./fixtures/original-35-backgrounds.json', import.meta.url), 'utf8'),
  )
  assert.deepEqual(BACKGROUNDS.slice(0, 35), withApprovedRoomCopy(prior))
  assert.deepEqual(
    BACKGROUNDS.slice(35).map((room) => room.scene),
    [35, 36, 37],
  )
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    for (const room of BACKGROUNDS.slice(35, 37)) {
      const markup = renderToStaticMarkup(
        createElement(Cafe, { backgroundId: room.id, thumbnail: true }),
      )
      assert.ok(markup.includes('data-special-prop="steaming-coffee"'))
      if (room.scene === 35) {
        assert.ok(markup.includes('data-activity="pouring-coffee"'))
        assert.ok(markup.includes('data-special-prop="espresso-machine"'))
        assert.ok(markup.includes('data-special-prop="coffee-stream"'))
      } else {
        assert.ok(markup.includes('data-special-prop="dome-ribs"'))
        assert.ok(markup.includes('scene-rain-heavy'))
      }
    }
  } finally {
    await server.close()
  }
})

test('window architecture drives real room openings and shared rain geometry, including the appended neon cafe', async () => {
  const { getSceneArchitecture } = await import('../src/pages/focus/model/sceneArchitecture.ts')
  assert.equal(BACKGROUNDS.at(-1)?.id, 'cafe-neon-night')
  assert.equal(BACKGROUNDS.at(-1)?.scene, 37)
  assert.ok(new Set(BACKGROUNDS.map((room) => getSceneArchitecture(room.scene).kind)).size >= 10)
  for (const scene of [6, 9, 20, 36])
    assert.equal(
      getSceneArchitecture(scene).kind,
      ({ 6: 'attic', 9: 'round', 20: 'train', 36: 'dome' } as Record<number, string>)[scene],
    )
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    for (const scene of [1, 3, 4, 6, 7, 9, 13, 20, 26, 27, 37]) {
      const room = BACKGROUNDS.find((room) => room.scene === scene)!
      const markup = renderToStaticMarkup(createElement(Cafe, { backgroundId: room.id }))
      assert.ok(markup.includes(`data-window-kind="${getSceneArchitecture(scene).kind}"`), room.id)
      assert.ok(markup.includes(getSceneArchitecture(scene).opening), room.id)
      if (scene === 37) {
        assert.ok(markup.includes('data-city-art="rainy-neon"'))
        assert.ok(markup.includes('data-detail="neon-sign"'))
        assert.ok(markup.includes('data-detail="neon-reflection"'))
        for (const sign of ['RAIN', 'OPEN', 'CAFE']) assert.ok(markup.includes(sign))
      }
    }
  } finally {
    await server.close()
  }
})

test('reviewed indoor furnishings stay in front of windows and retain matching rain exclusions', async () => {
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
    for (const scene of [2, 4, 7, 8, 22, 24, 27, 30, 34]) {
      const room = BACKGROUNDS.find((room) => room.scene === scene)!
      const markup = renderToStaticMarkup(createElement(Cafe, { backgroundId: room.id }))
      window.document.body.innerHTML = markup
      const document = window.document
      assert.equal(
        document.querySelectorAll('[data-light-kind]').length,
        getSceneInterior(room.id).lights.length,
        room.id,
      )
      if (scene === 7) {
        assert.ok(document.querySelector('.cozy-room [data-furnishing="library-shelves"]'))
        assert.ok(!markup.includes('M160 600V230Q400-80 640 230v370'))
      }
      if (scene === 8) {
        assert.ok(document.querySelector('.cozy-room [data-furnishing="work-monitor"]'))
        assert.ok(document.querySelector('mask rect[x="305"][y="480"]'))
        assert.ok(!markup.includes('M220 440h300v180H220z'))
      }
      if (scene === 22) {
        assert.ok(document.querySelector('.cozy-room [data-furnishing="camper-dashboard"]'))
        assert.ok(!markup.includes('M80 430q0-60 60-60'))
      }
      if (scene === 24) {
        const scope = document.querySelector(
          '.cozy-room [data-furnishing="observatory-telescope"]',
        )!
        assert.ok(
          scope.querySelector('path[d="M601 500L625 534"]'),
          'the telescope needs a connected tube-to-mount trunnion',
        )
        assert.ok(
          document.querySelector(`mask g[transform="${scope.getAttribute('transform')}"]`),
          'rain mask follows the entire repositioned telescope',
        )
      }
      if (scene === 30) assert.ok(!markup.includes('M168 548h94v32h-94z'))
      if (scene === 34) assert.ok(document.querySelector('mask rect[x="60"][y="505"][width="150"]'))
    }
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})
