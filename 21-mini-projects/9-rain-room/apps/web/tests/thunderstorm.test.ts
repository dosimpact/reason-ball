import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture, TextureSource, type Graphics } from 'pixi.js'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { getSceneWeather } from '../src/pages/focus/model/sceneWeather.ts'
import {
  createPixiWeather,
  createWeatherParticles,
  weatherParticlePosition,
  PIXI_WEATHER_PROFILES,
  stormWeatherState,
} from '../src/pages/focus/lib/pixiWeather.ts'
import {
  createThunderstormTimeline,
  thunderstormWeatherState,
  thunderstormEventEnvelope,
  THUNDERSTORM_CYCLE_SECONDS,
  THUNDERSTORM_BOLTS,
  thunderstormBoltMarkup,
  thunderstormSkyMarkup,
  thunderstormReflectionMarkup,
} from '../src/pages/focus/model/thunderstorm.ts'
const seed = [...'premium-storm-lighthouse'].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)

test('only lighthouse uses seventh kind; original storm rain and rare lightning remain unchanged', () => {
  assert.deepEqual(
    ALL_BACKGROUNDS.filter((r) => getSceneWeather(r.id) === 'thunderstorm').map((r) => r.id),
    ['premium-storm-lighthouse'],
  )
  assert.equal(new Set(ALL_BACKGROUNDS.map((r) => getSceneWeather(r.id))).size, 7)
  assert.equal(getSceneWeather('water-falls'), 'storm')
  assert.equal(getSceneWeather('premium-sakura-teahouse'), 'sakura-rain')
  assert.deepEqual(PIXI_WEATHER_PROFILES.thunderstorm, PIXI_WEATHER_PROFILES.storm)
  const before = createWeatherParticles('storm', 800, 820, seed)
  assert.deepEqual(createWeatherParticles('thunderstorm', 800, 820, seed), before)
  for (const time of [0, 3.6, 54.91, 1e6])
    for (const p of before)
      assert.deepEqual(
        weatherParticlePosition(p, 'thunderstorm', 800, 820, time),
        weatherParticlePosition(p, 'storm', 800, 820, time),
      )
  assert.deepEqual(stormWeatherState(2, seed), { flash: 0, gust: 0, travelTime: 2 })
  assert.ok(stormWeatherState(42 + (Math.abs(seed) % 29) + 0.91, seed).flash > 0.119)
})

test('seeded four-variant cycle starts promptly with five-to-eight-second strikes and staggered pulses', () => {
  for (const seed of [0, 1, 42, 2506, 65535]) {
    const timeline = createThunderstormTimeline(seed)
    assert.deepEqual(timeline, createThunderstormTimeline(seed))
    assert.equal(timeline.cycleSeconds, 27)
    assert.equal(timeline.events.length, 4)
    assert.equal(new Set(timeline.events.map((e) => e.variant)).size, 4)
    assert.ok(timeline.events[0]!.start >= 1.2 && timeline.events[0]!.start <= 2)
    timeline.events.forEach((e, i) => {
      const next = timeline.events[(i + 1) % 4]!.start + (i === 3 ? timeline.cycleSeconds : 0)
      assert.ok(next - e.start >= 5 && next - e.start <= 8.000001)
      assert.ok(e.pulses.length === 1 || e.pulses.length === 2)
      assert.ok(e.start + e.duration < timeline.cycleSeconds)
      if (e.pulses.length === 2) assert.ok(e.pulses[1]!.offset >= 0.7)
      assert.ok(thunderstormWeatherState(e.start + e.pulses[0]!.attack, seed).boltAlpha > 0.9)
      assert.ok(thunderstormEventEnvelope(e, 1.5).skyAlpha > 0, 'faint afterglow follows the bolt')
    })
  }
  assert.notDeepEqual(createThunderstormTimeline(1), createThunderstormTimeline(2))
})

test('quiet gaps never flash, repeated clocks freeze and long-clock state stays finite', () => {
  const timeline = createThunderstormTimeline(seed)
  for (let t = 0; t < THUNDERSTORM_CYCLE_SECONDS * 3; t += 0.037) {
    const state = thunderstormWeatherState(t, seed)
    assert.deepEqual(state, thunderstormWeatherState(t, seed))
    assert.ok(state.boltAlpha >= 0 && state.boltAlpha <= 1)
    assert.ok(state.skyAlpha >= 0 && state.skyAlpha <= 0.17)
    assert.ok(state.reflectionAlpha >= 0 && state.reflectionAlpha <= 0.28)
    const phase = t % timeline.cycleSeconds
    if (!timeline.events.some((e) => phase >= e.start && phase < e.start + e.duration)) {
      assert.equal(state.variant, -1)
      for (const key of ['boltAlpha', 'skyAlpha', 'cloudAlpha', 'reflectionAlpha', 'gust'] as const)
        assert.equal(state[key], 0)
    }
  }
  for (const t of [0, -1, NaN, Infinity, 3600, 1e6, 1e12, Number.MAX_VALUE])
    assert.ok(Object.values(thunderstormWeatherState(t, seed)).every(Number.isFinite))
})

test('integrated gust rain clock travels forward without jumps at cycle boundaries', () => {
  for (let t = 0; t < 300; t += 0.05) {
    const a = thunderstormWeatherState(t, seed),
      b = thunderstormWeatherState(t + 0.001, seed)
    assert.ok(b.travelTime >= a.travelTime)
    assert.ok(b.travelTime - a.travelTime < 0.002)
  }
  for (const t of [27, 54, 81]) {
    const a = thunderstormWeatherState(t - 1e-5, seed).travelTime,
      b = thunderstormWeatherState(t + 1e-5, seed).travelTime
    assert.ok(b > a && b - a < 0.0001)
  }
})

test('real native geometry follows shared lightning state and retains mask/context ownership', () => {
  const texture = new Texture({ source: new TextureSource({ width: 2400, height: 2460 }) }),
    weather = createPixiWeather({ weather: 'thunderstorm', maskTexture: texture, seed })
  const drawing = weather.container.children[0]!,
    mask = weather.container.children[1]!
  assert.equal(drawing.children.length, 730)
  assert.equal(drawing.mask, mask)
  assert.equal(mask.width, 800)
  assert.equal(mask.height, 820)
  const nodes = new Map(
    drawing.children
      .filter((n) => n.label?.startsWith('thunderstorm:'))
      .map((n) => [n.label, n as Graphics]),
  )
  assert.equal(nodes.size, 10)
  const contexts = [...nodes.values()].map((n) => n.context),
    instructions = contexts.map((c) => c.instructions.length)
  for (let v = 0; v < 4; v++) {
    const bolt = nodes.get(`thunderstorm:bolt:${v}`)!
    assert.ok(bolt.getLocalBounds().height > 200)
    assert.ok(bolt.context.instructions.length >= 4, 'main, halo and actual branches')
  }
  const first = createThunderstormTimeline(seed).events[0]!
  for (const time of [
    0,
    first.start + 0.085,
    first.start + 0.8,
    first.start + 1.5,
    first.start + 3.1,
    54.91,
  ]) {
    const state = thunderstormWeatherState(time, seed)
    weather.update(time)
    assert.equal(nodes.get('thunderstorm:sky')!.alpha, state.skyAlpha)
    assert.equal(nodes.get('thunderstorm:clouds')!.alpha, state.cloudAlpha)
    for (let v = 0; v < 4; v++) {
      assert.equal(
        nodes.get(`thunderstorm:bolt:${v}`)!.alpha,
        v === state.variant ? state.boltAlpha : 0,
      )
      assert.equal(
        nodes.get(`thunderstorm:reflection:${v}`)!.alpha,
        v === state.variant ? state.reflectionAlpha : 0,
      )
    }
    const snapshot = drawing.children.map((n) => ({ x: n.x, y: n.y, alpha: n.alpha }))
    weather.update(time)
    assert.deepEqual(
      drawing.children.map((n) => ({ x: n.x, y: n.y, alpha: n.alpha })),
      snapshot,
    )
  }
  assert.deepEqual(
    contexts.map((c) => c.instructions.length),
    instructions,
    'frames do not rebuild geometry',
  )
  weather.destroy()
  weather.destroy()
  weather.update(100)
  assert.equal(texture.destroyed, false)
  assert.ok(contexts.every((c) => c.destroyed))
  texture.destroy(true)
})

test('shared SVG branches/illumination are physical shapes and change actual CPU pixels', async () => {
  const sharp = (await import('sharp')).default,
    first = createThunderstormTimeline(seed).events[0]!,
    peak = thunderstormWeatherState(first.start + 0.085, seed)
  for (let v = 0; v < 4; v++) {
    const markup = thunderstormBoltMarkup(v)
    assert.equal((markup.match(/<path/g) ?? []).length, 2 + THUNDERSTORM_BOLTS[v]!.branches.length)
    assert.ok(!/filter=|<image|<text/.test(markup))
  }
  for (const markup of [
    thunderstormBoltMarkup(0, 0.4),
    thunderstormSkyMarkup(0.1, 0.2),
    thunderstormReflectionMarkup(0, 0.3),
  ]) {
    assert.ok(
      !/<g[^>]*\bopacity=/.test(markup),
      'node alpha belongs on each paint, not an isolated SVG group composite',
    )
    for (const paint of markup.match(/<(?:path|ellipse|rect)\b[^>]*>/g) ?? [])
      assert.match(paint, /\bopacity="[\d.]+"/, 'each overlapping paint carries its actual alpha')
  }
  const render = (visible: boolean) =>
    sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820">${visible ? thunderstormSkyMarkup(peak.skyAlpha, peak.cloudAlpha) + thunderstormBoltMarkup(peak.variant, peak.boltAlpha) + thunderstormReflectionMarkup(peak.variant, peak.reflectionAlpha) : ''}</svg>`,
      ),
    )
      .raw()
      .toBuffer()
  assert.notDeepEqual(await render(false), await render(true))
})
