import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateMotion } from '../src/pages/focus/lib/pixiSceneMotion.ts'
import { Texture, TextureSource, Point } from 'pixi.js'
import {
  stormWeatherState,
  createPixiWeather,
  createWeatherParticles,
  weatherParticlePosition,
  PIXI_WEATHER_PROFILES,
} from '../src/pages/focus/lib/pixiWeather.ts'
import {
  createSakuraPetals,
  sakuraPetalPose,
  sakuraPetalMarkup,
  SAKURA_PETAL_COUNT,
} from '../src/pages/focus/model/sakuraPetals.ts'

test('signature gestures preserve page turn, wing beat and distinct pivot rotation', () => {
  const page = evaluateMotion({ kind: 'signature-page', duration: 12, easing: 'linear' }, 12 * 0.78)
  assert.ok(Math.abs(page.scaleX! - 0.16) < 0.00001)
  assert.ok(Math.abs(page.skewY! + Math.PI / 15) < 0.00001)
  assert.equal(
    evaluateMotion({ kind: 'signature-wing', duration: 3, easing: 'linear' }, 0).scaleY,
    0.7,
  )
  assert.ok(
    evaluateMotion({ kind: 'signature-dial', duration: 9, easing: 'linear' }, 0).rotation! < 0,
  )
})
test('CSS delay, alternate direction and sparse independent property interpolation', () => {
  const motion = {
    kind: 'compiled',
    duration: 10,
    delay: -2,
    easing: 'linear',
    alternate: true,
    keyframes: [
      { offset: 0, x: 0, alpha: 0 },
      { offset: 0.5, alpha: 1 },
      { offset: 1, x: 100, alpha: 0 },
    ],
  }
  assert.ok(Math.abs(evaluateMotion(motion, 0).x! - 20) < 0.0001)
  assert.ok(Math.abs(evaluateMotion(motion, 10).x! - 80) < 0.0001)
  assert.deepEqual(evaluateMotion(motion, 5), evaluateMotion(motion, 5))
})
test('baked opacity is normalized while implicit CSS endpoints retain base opacity', () => {
  const motion = {
    kind: 'compiled',
    duration: 10,
    easing: 'linear',
    baseAlpha: 0.4,
    keyframes: [{ offset: 0.5, alpha: 0.2 }],
  }
  assert.equal(evaluateMotion(motion, 0).alpha, 1)
  assert.ok(Math.abs(evaluateMotion(motion, 5).alpha! - 0.5) < 0.00001)
})
test('all seven weather layouts are deterministic and bounded with explicit increasing rain tiers', () => {
  assert.ok(PIXI_WEATHER_PROFILES.rain.rain < PIXI_WEATHER_PROFILES['heavy-rain'].rain)
  assert.ok(PIXI_WEATHER_PROFILES['heavy-rain'].rain < PIXI_WEATHER_PROFILES.storm.rain)
  assert.ok(PIXI_WEATHER_PROFILES.snow.snow >= 400)
  for (const weather of [
    'rain',
    'heavy-rain',
    'storm',
    'sleet',
    'snow',
    'sakura-rain',
    'thunderstorm',
  ] as const) {
    const particles = createWeatherParticles(weather, 800, 820, 42)
    assert.deepEqual(particles, createWeatherParticles(weather, 800, 820, 42))
    assert.ok(particles.length <= 720)
    for (const p of particles) {
      const pos = weatherParticlePosition(p, weather, 800, 820, 100000)
      assert.ok(pos.x >= -90 && pos.x < 890 && pos.y >= -130 && pos.y < 950)
      assert.deepEqual(pos, weatherParticlePosition(p, weather, 800, 820, 100000))
    }
  }
})

test('real Pixi v8 Graphics and alpha sprite mask build every weather and preserve caller texture', () => {
  for (const weather of [
    'rain',
    'heavy-rain',
    'storm',
    'sleet',
    'snow',
    'sakura-rain',
    'thunderstorm',
  ] as const) {
    const weatherLayer = createPixiWeather({ weather, maskTexture: Texture.WHITE, seed: 23 })
    const drawing = weatherLayer.container.children[0]
    const contexts = new Set(
      drawing.children.map((node) => (node as import('pixi.js').Graphics).context),
    )
    assert.ok(drawing.mask)
    assert.equal(
      drawing.children.length,
      PIXI_WEATHER_PROFILES[weather].rain +
        PIXI_WEATHER_PROFILES[weather].snow +
        (weather === 'sakura-rain' ? SAKURA_PETAL_COUNT : 0) +
        (weather === 'storm' ? 1 : weather === 'thunderstorm' ? 10 : 0),
    )
    weatherLayer.update(10, 1 / 30)
    const position = drawing.children[0].position.clone()
    weatherLayer.update(10, 1 / 30)
    assert.equal(drawing.children[0].position.x, position.x)
    assert.equal(drawing.children[0].position.y, position.y)
    weatherLayer.destroy()
    weatherLayer.destroy()
    weatherLayer.update(20, 1 / 30)
    assert.equal(Texture.WHITE.destroyed, false)
    assert.ok(
      [...contexts].every((context) => context.destroyed),
      'every owned/shared weather context releases once',
    )
  }
})

test('storm lightning is rare, subdued, deterministic and shares the pausable clock', () => {
  assert.deepEqual(stormWeatherState(0, 23), { flash: 0, gust: 0, travelTime: 0 })
  const first = 42 + 23
  assert.ok(stormWeatherState(first + 0.91, 23).flash > 0.119)
  assert.equal(stormWeatherState(first + 3, 23).flash, 0)
  assert.equal(stormWeatherState(first + 5, 23).gust, 0)
  assert.ok(stormWeatherState(first + 2, 23).gust > 0.99)
  assert.deepEqual(stormWeatherState(first + 1, 23), stormWeatherState(first + 1, 23))
  for (let time = 0; time < 300; time += 0.25) {
    const state = stormWeatherState(time, 23)
    assert.ok(state.flash <= 0.12)
    assert.ok(stormWeatherState(time + 0.001, 23).travelTime >= state.travelTime)
  }
})

test('every compiled motion has finite authored channels and produces evaluator output', async () => {
  const { readdir, readFile } = await import('node:fs/promises')
  const root = new URL('../public/backgrounds/pixi/', import.meta.url)
  const rooms = (await readdir(root, { withFileTypes: true })).filter((entry) =>
    entry.isDirectory(),
  )
  assert.equal(rooms.length, 68)
  let count = 0
  for (const room of rooms) {
    const manifest = JSON.parse(await readFile(new URL(`${room.name}/manifest.json`, root), 'utf8'))
    for (const layer of manifest.layers)
      for (const motion of layer.motions ?? (layer.motion ? [layer.motion] : [])) {
        const label = `${room.name}/${layer.id}/${motion.cssName ?? motion.kind}`
        assert.ok(motion.keyframes?.length, `${label}: missing compiled keyframes`)
        assert.ok(
          motion.keyframes.some((frame: Record<string, number>) =>
            Object.keys(frame).some((key) => key !== 'offset'),
          ),
          `${label}: empty keyframe channels`,
        )
        for (const frame of motion.keyframes)
          for (const [key, value] of Object.entries(frame))
            assert.ok(
              typeof value === 'number' && Number.isFinite(value),
              `${label}: nonfinite ${key}`,
            )
        assert.ok(Object.keys(evaluateMotion(motion, 0)).length, `${label}: silent static fallback`)
        count++
      }
  }
  assert.ok(count > 120, `expected complete dynamic scene collection; got ${count}`)
})

test('3x weather mask keeps 800×820 logical aperture and remains caller-owned', () => {
  const texture = new Texture({ source: new TextureSource({ width: 2400, height: 2460 }) })
  const weather = createPixiWeather({
    weather: 'storm',
    maskTexture: texture,
    width: 800,
    height: 820,
  })
  const mask = weather.container.children[1]
  assert.equal(mask.width, 800)
  assert.equal(mask.height, 820)
  assert.equal(mask.scale.x, 1 / 3)
  assert.equal(mask.scale.y, 1 / 3)
  weather.update(66, 1 / 30)
  assert.equal(mask.width, 800)
  assert.equal(mask.height, 820)
  weather.destroy()
  assert.equal(texture.destroyed, false)
  texture.destroy(true)
})

test('sakura adds independently seeded petals without changing a single baseline rain drop or old profile', () => {
  const { petals, ...rain } = PIXI_WEATHER_PROFILES['sakura-rain']
  assert.deepEqual(rain, PIXI_WEATHER_PROFILES.rain)
  assert.equal(petals, 36)
  assert.deepEqual(
    createWeatherParticles('sakura-rain', 800, 820, 42).slice(0, 330),
    createWeatherParticles('rain', 800, 820, 42),
  )
  assert.deepEqual(
    {
      rain: PIXI_WEATHER_PROFILES.rain.rain,
      heavy: PIXI_WEATHER_PROFILES['heavy-rain'].rain,
      storm: PIXI_WEATHER_PROFILES.storm.rain,
      sleetRain: PIXI_WEATHER_PROFILES.sleet.rain,
      sleetSnow: PIXI_WEATHER_PROFILES.sleet.snow,
      snow: PIXI_WEATHER_PROFILES.snow.snow,
    },
    { rain: 330, heavy: 540, storm: 720, sleetRain: 250, sleetSnow: 220, snow: 410 },
  )
  const drops = createWeatherParticles('rain', 800, 820, 42)
  for (const time of [0, 1.8, 73, 100000])
    for (const drop of drops)
      assert.deepEqual(
        weatherParticlePosition(drop, 'sakura-rain', 800, 820, time),
        weatherParticlePosition(drop, 'rain', 800, 820, time),
      )
})

test('petals independently drift, fall and tumble with deterministic finite absolute-clock poses', async () => {
  const particles = createSakuraPetals(800, 820, 42)
  assert.equal(particles.length, 36)
  assert.deepEqual(particles, createSakuraPetals(800, 820, 42))
  assert.notDeepEqual(particles, createSakuraPetals(800, 820, 43))
  assert.equal(new Set(particles.map((p) => p.color)).size, 3)
  assert.ok(new Set(particles.map((p) => p.speed)).size > 20)
  for (const p of particles)
    for (const time of [0, 0.5, 6, 60, 3600, 1e6, 1e12, Number.MAX_VALUE, NaN, Infinity, -1]) {
      const pose = sakuraPetalPose(p, 800, 820, time)
      assert.ok(Object.values(pose).every(Number.isFinite))
      assert.ok(pose.x >= -90 && pose.x < 890 && pose.y >= -130 && pose.y < 950)
      assert.ok(pose.scaleX > 0 && pose.scaleY > 0 && pose.alpha > 0 && pose.alpha <= 1)
      assert.deepEqual(pose, sakuraPetalPose(p, 800, 820, time), 'same clock freezes every channel')
    }
  const first = particles[0]!,
    a = sakuraPetalPose(first, 800, 820, 0),
    b = sakuraPetalPose(first, 800, 820, 3.6)
  for (const key of ['x', 'y', 'rotation', 'scaleX', 'alpha'] as const)
    assert.notEqual(a[key], b[key], key)
  const sharp = (await import('sharp')).default
  const raster = (pose: typeof a) =>
    sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820">${sakuraPetalMarkup(first, pose)}</svg>`,
      ),
    )
      .raw()
      .toBuffer()
  assert.notDeepEqual(
    await raster(a),
    await raster(b),
    'shared CPU shape/pose actually changes pixels',
  )
})

test('native petal geometry shares three contexts, follows shared poses and releases ownership safely', () => {
  const texture = new Texture({ source: new TextureSource({ width: 2400, height: 2460 }) })
  const layer = createPixiWeather({ weather: 'sakura-rain', maskTexture: texture, seed: 42 })
  const drawing = layer.container.children[0]!,
    mask = layer.container.children[1]!
  const petals = drawing.children.slice(330),
    specs = createSakuraPetals(800, 820, 42)
  assert.equal(petals.length, 36)
  assert.equal(drawing.mask, mask)
  assert.equal(mask.width, 800)
  assert.equal(mask.height, 820)
  const contexts = new Set(petals.map((node) => (node as import('pixi.js').Graphics).context))
  assert.equal(contexts.size, 3)
  const context = [...contexts][0]!
  assert.equal(context.containsPoint(new Point(0, 0)), true)
  assert.equal(context.containsPoint(new Point(0, -5.4)), false, 'top notch remains open')
  const instructionCounts = [...contexts].map((c) => c.instructions.length)
  for (const time of [0, 3.6, 100000]) {
    layer.update(time)
    petals.forEach((node, index) => {
      const pose = sakuraPetalPose(specs[index]!, 800, 820, time)
      assert.equal(node.position.x, pose.x)
      assert.equal(node.position.y, pose.y)
      assert.equal(node.rotation, pose.rotation)
      assert.equal(node.scale.x, pose.scaleX)
      assert.equal(node.scale.y, pose.scaleY)
      assert.equal(node.alpha, pose.alpha)
    })
  }
  assert.deepEqual(
    [...contexts].map((c) => c.instructions.length),
    instructionCounts,
    'updates do not rebuild geometry',
  )
  layer.destroy()
  layer.destroy()
  layer.update(200000)
  assert.equal(texture.destroyed, false)
  for (const context of contexts) assert.equal(context.destroyed, true)
  texture.destroy(true)
})
