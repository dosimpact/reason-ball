import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { getIndoorCatAnchor } from '../src/pages/focus/model/sceneAnimals.ts'
import { getSceneInterior } from '../src/pages/focus/model/sceneInterior.ts'
import { BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { SCENE_EFFECTS, validateSceneEffects } from '../src/pages/focus/model/sceneEffects.ts'
import {
  SceneEffectCycle,
  REST_EFFECTS,
  type EffectState,
} from '../src/pages/focus/lib/sceneEffectCycle.ts'
test('effect catalog covers all spaces with valid raster paths and artwork anchors', () => {
  assert.deepEqual(validateSceneEffects(), [])
  assert.equal(Object.keys(SCENE_EFFECTS).length, 38)
  for (const room of BACKGROUNDS) {
    assert.equal(Boolean(SCENE_EFFECTS[room.id].cat), Boolean(getIndoorCatAnchor(room)))
    assert.ok(existsSync(`public${SCENE_EFFECTS[room.id].assetPath}`))
    assert.equal(SCENE_EFFECTS[room.id].weather.thunderAudio, false)
  }
  const storms = Object.values(SCENE_EFFECTS).filter((scene) => scene.weather.storm)
  assert.deepEqual(
    storms.map((scene) => scene.id).sort(),
    [
      'cafe-rain-dome',
      'water-harbor-deep',
      'water-velvet-tide',
      'cafe-seaside',
      'water-harbor',
      'travel-lodge',
    ].sort(),
  )
  assert.equal(Object.values(SCENE_EFFECTS).filter((scene) => scene.lamps.length).length, 15)
  const broken = structuredClone(SCENE_EFFECTS)
  broken['cafe-rain'].timing.yawnDuration = NaN
  broken['cafe-rain'].weather.gustDelay[0] = Infinity
  broken['cafe-rain'].weather.storm = 'yes' as unknown as boolean
  broken['cafe-rain'].weather.base = 'snow' as 'rain'
  assert.ok(validateSceneEffects(broken).length >= 3)
  assert.ok(
    validateSceneEffects({ ...SCENE_EFFECTS, unexpected: SCENE_EFFECTS['cafe-rain'] }).length,
  )
})
test('effect cycle schedules bounded random events and stop invalidates pending or active work', () => {
  let next = 0
  const tasks = new Map<number, { fn: () => void; delay: number }>()
  let state: EffectState = REST_EFFECTS
  const cycle = new SceneEffectCycle(
    (value) => (state = value),
    {
      set: (fn, delay) => {
        tasks.set(++next, { fn, delay })
        return next
      },
      clear: (id) => {
        tasks.delete(id as number)
      },
    },
    () => 0.5,
  )
  cycle.start(true, true, [45000, 100000], [8000, 14000], [90000, 180000])
  assert.deepEqual(
    [...tasks.values()].map((task) => task.delay),
    [62500, 72500, 135000],
  )
  const yawn = tasks.get(1)!.fn
  tasks.delete(1)
  yawn()
  assert.equal(state.yawn, true)
  const late = [...tasks.values()].map((task) => task.fn)
  cycle.stop()
  assert.deepEqual(state, REST_EFFECTS)
  assert.equal(tasks.size, 0)
  late.forEach((fn) => fn())
  assert.deepEqual(state, REST_EFFECTS)
  assert.equal(tasks.size, 0)
  cycle.start(false, false, [1, 2], [1, 2], [1, 2])
  assert.equal(tasks.size, 0)
})
test('overlapping rain and lightning swells do not end one another early', () => {
  let now = 0
  let id = 0
  let state: EffectState = REST_EFFECTS
  const tasks = new Map<number, { at: number; fn: () => void }>()
  const cycle = new SceneEffectCycle(
    (value) => (state = value),
    {
      set: (fn, delay) => {
        tasks.set(++id, { at: now + delay, fn })
        return id
      },
      clear: (id) => {
        tasks.delete(id as number)
      },
    },
    () => 0,
  )
  const advance = (until: number) => {
    while (true) {
      const next = [...tasks]
        .filter(([, task]) => task.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      now = next[1].at
      tasks.delete(next[0])
      next[1].fn()
    }
    now = until
  }
  cycle.start(false, true, [45000, 45000], [14000, 14000], [50000, 50000])
  advance(45000)
  assert.equal(state.gust, true)
  advance(50000)
  assert.equal(state.lightning, true)
  advance(59000)
  assert.equal(state.gust, true, 'lightning swell remains after normal gust ends')
  advance(64000)
  assert.equal(state.gust, false)
  cycle.stop()
  assert.equal(tasks.size, 0)
})

test('all rooms have at least two grounded detail families with bounded count, intensity and timing', async () => {
  const { DETAIL_KINDS, validateSceneDetails } = await import(
    '../src/pages/focus/model/sceneDetails.ts'
  )
  const configs = Object.fromEntries(
    Object.values(SCENE_EFFECTS).map((config) => [config.id, config.details]),
  )
  assert.deepEqual(validateSceneDetails(configs), [])
  assert.equal(
    new Set(Object.values(configs).flatMap((details) => details.map((detail) => detail.kind))).size,
    DETAIL_KINDS.length,
  )
  assert.ok(
    new Set(Object.values(configs).map((details) => details.map((detail) => detail.kind).join(',')))
      .size >= 10,
  )
  assert.equal(
    configs['water-stream'].find((detail) => detail.kind === 'water-ripples')!.surface,
    'stream',
  )
  assert.equal(
    configs['water-falls'].find((detail) => detail.kind === 'water-ripples')!.surface,
    'falls',
  )
  assert.ok(!configs['cafe-rain-dome'].some((detail) => detail.kind === 'water-ripples'))
  assert.deepEqual(
    configs['study-library'].map((detail) => detail.kind),
    ['dust', 'table-reflection'],
  )
  const invalid = structuredClone(configs)
  invalid['cafe-rain'][0].count = 7
  invalid['cafe-rain'][0].intensity = NaN
  invalid['cafe-rain'][0].delay = Infinity
  assert.ok(validateSceneDetails(invalid).length >= 2)
  assert.ok(
    validateSceneDetails({ ...configs, typo: configs['cafe-rain'] }).some((error) =>
      error.includes('unexpected'),
    ),
  )
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(
    new URL('../src/pages/focus/ui/scene-effects.css', import.meta.url),
    'utf8',
  )
  for (const animation of [
    'glass',
    'pass',
    'leaf',
    'ripple',
    'fall',
    'twinkle',
    'float',
    'ember',
    'curtain',
    'reflection',
  ])
    assert.ok(css.includes(`@keyframes detail-${animation}`))
  assert.match(css, /animation-play-state\s*:\s*paused/)
})

test('neon signs belong to distant facade planes with matching perspective and slow staggered light cycles', async () => {
  const { NEON_SIGNS, NEON_BUILDINGS } = await import('../src/pages/focus/model/neonSigns.ts')
  const ids = new Set(NEON_BUILDINGS.map((building) => building.id))
  assert.equal(ids.size, 3)
  assert.equal(new Set(NEON_SIGNS.map((sign) => sign.id)).size, 3)
  assert.equal(new Set(NEON_SIGNS.map((sign) => sign.transform)).size, 3)
  assert.equal(new Set(NEON_SIGNS.map((sign) => sign.duration)).size, 3)
  for (const sign of NEON_SIGNS) {
    assert.ok(ids.has(sign.buildingId))
    assert.ok(sign.duration >= 12)
    assert.ok(Number.isFinite(sign.delay))
    assert.match(sign.transform, /^matrix\(/)
    assert.ok(sign.width > 0 && sign.height > 0)
  }
  assert.ok(NEON_SIGNS.some((sign) => sign.vertical))
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
    window.document.body.innerHTML = renderToStaticMarkup(
      createElement(Cafe, { backgroundId: 'cafe-neon-night' }),
    )
    const document = window.document
    assert.equal(document.querySelectorAll('[data-opposite-building]').length, 3)
    for (const sign of NEON_SIGNS) {
      const mount = document.querySelector(`[data-sign-mount="${sign.id}"]`)!
      assert.equal(mount.getAttribute('data-building-id'), sign.buildingId)
      assert.equal(mount.getAttribute('transform'), sign.transform)
      assert.ok(mount.closest(`[data-opposite-building="${sign.buildingId}"]`))
      assert.ok(document.querySelector(`[data-facade-light="${sign.buildingId}"][clip-path]`))
    }
    assert.equal(
      document.querySelector('[data-city-art]')!.querySelectorAll('.detail-neon-water').length,
      0,
      'raster base reflections stay static; only the shared live overlay animates',
    )
    assert.equal(
      document.querySelectorAll('[data-detail="neon-sign"] .detail-neon-sparkle').length,
      3,
    )
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})
