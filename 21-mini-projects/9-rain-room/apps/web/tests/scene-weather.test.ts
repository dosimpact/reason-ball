import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Window } from 'happy-dom'
import { ALL_BACKGROUNDS, BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { PREMIUM_SPACES } from '../src/pages/focus/model/premiumSpaces.ts'
import { SCENE_WEATHER, getSceneWeather } from '../src/pages/focus/model/sceneWeather.ts'

test('all 68 IDs retain weather with room-specific sakura and lighthouse thunderstorm kinds', () => {
  assert.deepEqual(Object.keys(SCENE_WEATHER).sort(), ALL_BACKGROUNDS.map((room) => room.id).sort())
  const ordinaryKinds = ['heavy-rain', 'rain', 'sleet', 'snow', 'storm']
  assert.deepEqual(
    [...new Set(BACKGROUNDS.map((room) => getSceneWeather(room.id)))].sort(),
    ordinaryKinds,
  )
  assert.deepEqual([...new Set(PREMIUM_SPACES.map((room) => getSceneWeather(room.id)))].sort(), [
    'heavy-rain',
    'rain',
    'sakura-rain',
    'sleet',
    'snow',
    'storm',
    'thunderstorm',
  ])
  assert.deepEqual(
    ALL_BACKGROUNDS.filter((room) => getSceneWeather(room.id) === 'sakura-rain').map(
      (room) => room.id,
    ),
    ['premium-sakura-teahouse'],
  )
  assert.equal(getSceneWeather('premium-sakura-teahouse'), 'sakura-rain')
  assert.equal(getSceneWeather('missing'), 'rain')
  assert.equal(getSceneWeather('__proto__'), 'rain')
  assert.equal(getSceneWeather(), 'rain')
  assert.equal(getSceneWeather('garden-snow'), 'snow')
  assert.equal(getSceneWeather('premium-christmas-bookcafe'), 'snow')
  assert.equal(getSceneWeather('premium-storm-lighthouse'), 'thunderstorm')
  assert.deepEqual(
    ALL_BACKGROUNDS.filter((room) => getSceneWeather(room.id) === 'thunderstorm').map(
      (room) => room.id,
    ),
    ['premium-storm-lighthouse'],
  )
})
test('live precipitation has bounded geometry, mixed sleet, two snow depths and no rain in snow', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Drawing } = await server.ssrLoadModule(
      '/src/pages/focus/ui/SceneWeatherDrawing.tsx',
    )
    const { default: Overlay } = await server.ssrLoadModule('/src/pages/focus/ui/RainOverlay.tsx')
    for (const weather of [
      'rain',
      'heavy-rain',
      'storm',
      'sleet',
      'snow',
      'sakura-rain',
      'thunderstorm',
    ]) {
      const markup = renderToStaticMarkup(
        createElement('svg', null, createElement(Drawing, { weather, static: true })),
      )
      assert.ok(markup.includes(`data-weather="${weather}"`))
      assert.ok(markup.includes('data-paused="true"'))
      assert.equal(markup.includes('class="weather-rain"'), weather !== 'snow')
      assert.equal(markup.includes('weather-snow-0'), weather === 'snow' || weather === 'sleet')
      assert.equal(markup.includes('weather-snow-1'), weather === 'snow' || weather === 'sleet')
      assert.ok((markup.match(/<circle/g) ?? []).length < 10)
      if (weather === 'snow' || weather === 'sleet') assert.ok(markup.includes('<circle'))
      assert.equal(markup.includes('weather-sakura-fall'), weather === 'sakura-rain')
      assert.equal(markup.includes('class="weather-thunderstorm"'), weather === 'thunderstorm')
      if (weather === 'sakura-rain') {
        assert.equal(
          (markup.match(/data-weather-petal=/g) ?? []).length,
          72,
          '36 seeded petals have two offscreen wrap copies',
        )
        assert.ok(markup.includes('#d9a8b4'))
        assert.ok(markup.includes('weather-sakura-tumble'))
        assert.ok(!markup.includes('<ellipse'), 'petals have a notched asymmetrical outline')
        const window = new Window()
        window.document.body.innerHTML = markup
        for (let index = 0; index < 36; index++) {
          const copies = Array.from(
            window.document.querySelectorAll(`[data-weather-petal="${index}"]`),
          )
          const point = (node: (typeof copies)[number]) =>
            node
              .getAttribute('transform')!
              .match(/^translate\((\S+) ([^)]+)\)$/)!
              .slice(1)
              .map(Number)
          const previous = point(copies[0]!),
            next = point(copies[1]!)
          const fall = copies[0]!.querySelector<HTMLElement>('.weather-sakura-fall')!
          const travelX = Number.parseFloat(fall.style.getPropertyValue('--petal-wind'))
          const travelY = Number.parseFloat(fall.style.getPropertyValue('--petal-travel'))
          assert.ok(
            Math.abs(previous[0]! + travelX - next[0]!) < 1e-8,
            `petal${index}: horizontal position joins at fall-loop boundary`,
          )
          assert.ok(
            Math.abs(previous[1]! + travelY - next[1]!) < 1e-8,
            `petal${index}: vertical position joins at fall-loop boundary`,
          )
          for (const channel of ['weather-sakura-drift', 'weather-sakura-tumble'])
            assert.equal(
              copies[0]!.querySelector(`.${channel}`)!.getAttribute('style'),
              copies[1]!.querySelector(`.${channel}`)!.getAttribute('style'),
              `petal${index}: ${channel} phase stays aligned across wrap copies`,
            )
        }
        await window.happyDOM.abort()
      }
    }
    const rainLevels = ['rain', 'heavy-rain', 'storm'].map((weather) =>
      renderToStaticMarkup(
        createElement('svg', null, createElement(Drawing, { weather, static: true })),
      ),
    )
    const widths = rainLevels.map((html) => Number(html.match(/<pattern[^>]+width="([0-9]+)"/)![1]))
    assert.ok(
      widths[0]! > widths[1]! && widths[1]! > widths[2]!,
      'three rain levels increase tiled drop density',
    )
    assert.equal((rainLevels[0]!.match(/class="weather-rain/g) || []).length, 1)
    assert.equal(
      (rainLevels[2]!.match(/class="weather-rain/g) || []).length,
      2,
      'storm includes a separate depth layer',
    )
    const thunderRain = renderToStaticMarkup(
      createElement('svg', null, createElement(Drawing, { weather: 'thunderstorm', static: true })),
    )
    assert.equal(
      thunderRain.match(/<pattern\b[^]*?<\/pattern>/)![0],
      rainLevels[2]!.match(/<pattern\b[^]*?<\/pattern>/)![0],
      'thunderstorm retains the exact dense storm rain geometry',
    )
    const snow = renderToStaticMarkup(
      createElement(Overlay, { backgroundId: 'garden-snow', lightning: true, gust: true }),
    )
    assert.ok(!snow.includes('effect-lightning'))
    assert.ok(snow.includes('data-gust="false"'))
    assert.ok(snow.includes('clip-path='))
    assert.ok(snow.includes('mask='))
    assert.ok(snow.includes('style="opacity:1"'), 'legacy rain opacity must not dim new snow twice')
    const { PremiumAtmosphereDrawing } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumAtmosphere.tsx',
    )
    const sakuraAtmosphere = renderToStaticMarkup(
      createElement(
        'svg',
        null,
        createElement(PremiumAtmosphereDrawing, {
          spaceId: 'premium-sakura-teahouse',
          paused: true,
        }),
      ),
    )
    assert.ok(sakuraAtmosphere.includes('data-weather="sakura-rain"'))
    assert.ok(
      !sakuraAtmosphere.includes('class="premium-petals"'),
      'old ten-ellipse sheet must not double the new weather',
    )
    assert.ok(sakuraAtmosphere.includes('clip-path=') && sakuraAtmosphere.includes('mask='))
    assert.ok(sakuraAtmosphere.includes('data-paused="true"'))
    const storm = renderToStaticMarkup(
      createElement(Overlay, { backgroundId: 'water-falls', lightning: true }),
    )
    assert.ok(storm.includes('effect-lightning'))
    const thunder = renderToStaticMarkup(
      createElement(
        'svg',
        null,
        createElement(PremiumAtmosphereDrawing, { spaceId: 'premium-storm-lighthouse' }),
      ),
    )
    assert.ok(
      !thunder.includes('effect-lightning'),
      'legacy external flash must not double the new weather light',
    )
    assert.ok(thunder.includes('clip-path=') && thunder.includes('mask='))
    const window = new Window()
    window.document.body.innerHTML = thunder
    const weatherNode = window.document.querySelector('.scene-weather-drawing')!
    const flash = weatherNode.querySelector('.weather-thunderstorm')!
    assert.ok(flash, 'all new transient light belongs to the removable weather subtree')
    assert.equal(flash.querySelectorAll('[data-thunder-variant]').length, 4)
    assert.equal(
      new Set(
        Array.from(flash.querySelectorAll('[data-thunder-variant]')).map((node) =>
          node.getAttribute('data-thunder-variant'),
        ),
      ).size,
      4,
    )
    const starts = Array.from(flash.querySelectorAll('[data-thunder-start]')).map((node) =>
      Number(node.getAttribute('data-thunder-start')),
    )
    assert.ok(
      starts[0]! >= 1.2 && starts[0]! <= 2,
      'first visible event starts promptly, after a quiet opening',
    )
    for (let i = 1; i < starts.length; i++)
      assert.ok(starts[i]! - starts[i - 1]! >= 5 && starts[i]! - starts[i - 1]! <= 8)
    assert.equal(flash.querySelectorAll('.weather-thunder-channel').length, 16)
    for (const channel of flash.querySelectorAll('.weather-thunder-channel')) {
      assert.equal(
        channel.getAttribute('opacity'),
        '0',
        'unanimated/static source never bakes a bright flash',
      )
      assert.ok(channel.getAttribute('style')!.includes('27s'))
    }
    const bolts = flash.querySelectorAll('.weather-thunder-boltAlpha')
    for (const bolt of bolts) {
      assert.equal(
        bolt.querySelectorAll('path').length,
        4,
        'main stroke, soft halo and two branches',
      )
      assert.ok(bolt.querySelector('g[fill="none"]'))
      assert.ok(
        Array.from(bolt.querySelectorAll('path')).every(
          (node) => (node.getAttribute('d')!.match(/L/g) ?? []).length >= 2,
        ),
      )
    }
    for (const channel of flash.querySelectorAll<HTMLElement>('.weather-thunder-channel')) {
      assert.equal(channel.style.getPropertyValue('--thunder-alpha-0'), '0')
      assert.equal(channel.style.getPropertyValue('--thunder-alpha-18'), '0')
      assert.ok(Number(channel.style.getPropertyValue('--thunder-alpha-3')) > 0)
      for (let i = 0; i < 19; i++) {
        const value = Number(channel.style.getPropertyValue(`--thunder-alpha-${i}`))
        assert.ok(Number.isFinite(value) && value >= 0 && value <= 1)
      }
    }
    const lighthouseAtmosphere = renderToStaticMarkup(
      createElement(
        'svg',
        null,
        createElement(PremiumAtmosphereDrawing, {
          spaceId: 'premium-storm-lighthouse',
          static: true,
        }),
      ),
    )
    assert.ok(
      lighthouseAtmosphere.includes('data-weather="thunderstorm"') &&
        lighthouseAtmosphere.includes('data-static="true"'),
    )
    assert.ok(lighthouseAtmosphere.includes('clip-path=') && lighthouseAtmosphere.includes('mask='))
    assert.ok(!lighthouseAtmosphere.includes('effect-lightning'))
    await window.happyDOM.abort()
  } finally {
    await server.close()
  }
})
test('weather CSS stops for static, pause and reduced motion', () => {
  const css = readFileSync(new URL('../src/pages/focus/ui/weather.css', import.meta.url), 'utf8')
  for (const token of [
    'data-paused="true"',
    'data-static="true"',
    'prefers-reduced-motion',
    'animation-play-state',
    'animation: none',
  ])
    assert.ok(css.includes(token), token)
})

test('sakura fallback keeps ordinary rain while individual petal channels and background stack freeze safely', () => {
  const css = readFileSync(new URL('../src/pages/focus/ui/weather.css', import.meta.url), 'utf8')
  for (const name of ['weather-sakura-fall', 'weather-sakura-drift', 'weather-sakura-tumble'])
    assert.ok(css.includes('@keyframes ' + name))
  assert.ok(css.includes('pointer-events: none'))
  const viewport = readFileSync(
    new URL('../src/pages/focus/ui/viewport-rain.css', import.meta.url),
    'utf8',
  )
  assert.match(
    viewport,
    /data-weather="rain"\]::before,\s*\.viewport-rain\[data-weather="sakura-rain"\]::before/,
  )
  assert.ok(viewport.includes('viewport-sakura-petals'))
  assert.ok(viewport.includes('animation-play-state: paused'))
  assert.ok(viewport.includes('prefers-reduced-motion'))
  assert.ok(viewport.includes('pointer-events: none !important'))
  assert.match(viewport, /\.viewport-rain\s*\{[^}]*z-index:\s*0/s)
})

test('new thunderstorm light is scoped, static/reduced-safe and keeps old storm rain CSS', () => {
  const css = readFileSync(new URL('../src/pages/focus/ui/weather.css', import.meta.url), 'utf8')
  assert.match(
    css,
    /\[data-weather="storm"\] \.weather-rain,\s*\[data-weather="thunderstorm"\] \.weather-rain\s*\{/,
  )
  assert.ok(css.includes('[data-weather="thunderstorm"] .weather-rain-depth'))
  assert.ok(css.includes('[data-gust="true"] [data-weather="thunderstorm"] .weather-rain'))
  assert.match(css, /data-static="true"\] \.weather-thunderstorm[^}]*display:\s*none !important/s)
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.weather-thunderstorm\s*\{\s*display:\s*none !important/s,
  )
  assert.ok(css.includes('animation-iteration-count: infinite'))
  const viewport = readFileSync(
    new URL('../src/pages/focus/ui/viewport-rain.css', import.meta.url),
    'utf8',
  )
  assert.ok(viewport.includes('[data-weather="thunderstorm"]::before'))
  assert.ok(viewport.includes('[data-weather="thunderstorm"]::after'))
  const atmosphere = readFileSync(
    new URL('../src/pages/focus/ui/SceneAtmosphere.tsx', import.meta.url),
    'utf8',
  )
  assert.ok(atmosphere.includes("weather === 'storm' || weather === 'thunderstorm'"))
  assert.ok(atmosphere.includes("lightning={weather === 'storm' && effects.lightning}"))
  const overlay = readFileSync(
    new URL('../src/pages/focus/ui/RainOverlay.tsx', import.meta.url),
    'utf8',
  )
  assert.ok(overlay.includes("weather === 'storm' || weather === 'thunderstorm'"))
  assert.ok(overlay.includes('data-gust={storm && gust}'))
  assert.ok(overlay.includes("lightning && weather === 'storm'"))
})
