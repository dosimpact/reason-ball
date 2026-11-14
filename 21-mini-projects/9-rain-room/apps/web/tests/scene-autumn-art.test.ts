import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Window } from 'happy-dom'
import sharp from 'sharp'
import { AUTUMN_SPACES } from '../src/pages/focus/model/sceneAutumn.ts'
import { getSceneArchitecture } from '../src/pages/focus/model/sceneArchitecture.ts'
import { premiumGeometry } from '../src/pages/focus/ui/premium/premiumGeometry.ts'

test('autumn artwork remains distinct, clipped and extractable without changing the room layers', async () => {
  const { createServer } = await import('vite')
  const { createElement, Fragment } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const window = new Window()
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    const { default: Scenery } = await server.ssrLoadModule('/src/pages/focus/ui/AutumnScenery.tsx')
    const identities = new Set<string>()
    for (const space of AUTUMN_SPACES) {
      const premium = space.id.startsWith('premium-')
      const geometry = premium ? premiumGeometry(space.id) : getSceneArchitecture(space.scene)
      const rear = renderToStaticMarkup(
        createElement(Cafe, { backgroundId: space.id, artOnly: true, layer: 'rear' }),
      )
      window.document.body.innerHTML = rear
      const scenery = window.document.querySelector('[data-autumn-scene]')!
      assert.ok(scenery, space.id + ': authored outdoor scenery missing')
      assert.equal(scenery.getAttribute('data-autumn-scene'), space.id)
      identities.add(scenery.getAttribute('data-autumn-motif')!)
      assert.equal(
        window.document.querySelectorAll('.autumn-leaf-fall').length,
        0,
        space.id + ': rear is baked; moving leaves must not be trapped in that bitmap',
      )
      assert.equal(scenery.querySelector('clipPath path')!.getAttribute('d'), geometry.opening)
      assert.ok(!scenery.querySelector('image, filter, text, foreignObject'))

      const foreground = renderToStaticMarkup(
        createElement(Cafe, { backgroundId: space.id, artOnly: true, layer: 'foreground' }),
      )
      window.document.body.innerHTML = foreground
      assert.equal(window.document.querySelectorAll('[data-autumn-scene]').length, 0)
      const motion = window.document.querySelector('[data-autumn-motion]')!
      assert.equal(motion.getAttribute('data-autumn-motion'), space.id)
      assert.equal(
        motion.querySelectorAll('.autumn-leaf-fall').length,
        3,
        space.id + ': only three separately extractable leaves are allowed',
      )
      assert.equal(motion.querySelector('clipPath path')!.getAttribute('d'), geometry.opening)
      assert.equal(motion.querySelector('mask path')!.getAttribute('d'), geometry.frames)
      const fixedMask = motion.querySelector('g[clip-path][mask]')!
      for (const leaf of motion.querySelectorAll('.autumn-leaf-fall'))
        assert.ok(fixedMask.contains(leaf), 'clip/mask must remain on a stationary ancestor')
      const life = window.document.querySelector(
        premium ? '[data-premium-layer="living-landscape"]' : '.scene-outdoor-life',
      )!
      assert.ok(
        life && motion.compareDocumentPosition(life) & 4,
        'existing animals/supports must paint after the outdoor leaves',
      )

      // Test the actual new foreground fragments, including a deliberately edge-crossing pose.
      for (const leaf of motion.querySelectorAll('.autumn-leaf-fall')) {
        leaf.setAttribute('transform', 'translate(170 130) rotate(45)')
        leaf.removeAttribute('style')
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820">${motion.outerHTML}</svg>`
      const actual = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()
      const mask = await sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820"><path d="${geometry.opening}" fill="white"/></svg>`,
        ),
      )
        .ensureAlpha()
        .raw()
        .toBuffer()
      let outside = 0
      for (let i = 3; i < actual.length; i += 4) if (actual[i]! > 0 && mask[i] === 0) outside++
      assert.equal(outside, 0, space.id + ': a moving leaf escaped the actual opening')
    }
    assert.equal(identities.size, 8, 'each selected place has its own authored autumn motif')

    window.document.body.innerHTML = renderToStaticMarkup(
      createElement(
        'svg',
        null,
        createElement(
          Fragment,
          null,
          createElement(Scenery, { scene: 30 }),
          createElement(Scenery, { scene: 30 }),
        ),
      ),
    )
    const ids = Array.from(window.document.querySelectorAll('[id]')).map((node) => node.id)
    assert.equal(
      new Set(ids).size,
      ids.length,
      'two simultaneous scenes must have unique paint/clip IDs',
    )
    for (const node of window.document.querySelectorAll('*'))
      for (const attr of node.attributes)
        for (const match of attr.value.matchAll(/url\(#([^)]+)\)/g))
          assert.ok(ids.includes(match[1]!), 'unresolved authored SVG reference')

    const linen = renderToStaticMarkup(
      createElement('svg', null, createElement(Scenery, { scene: 30 })),
    )
    const court = renderToStaticMarkup(
      createElement('svg', null, createElement(Scenery, { scene: 26 })),
    )
    assert.ok(linen.includes('data-autumn-detail="persimmon-fruit"'))
    assert.ok(court.includes('data-autumn-detail="chrysanthemums"'))
    for (const id of ['cafe-greenhouse', 'premium-wizard-library']) {
      const markup = renderToStaticMarkup(createElement(Cafe, { backgroundId: id, artOnly: true }))
      assert.ok(!markup.includes('data-autumn-scene') && !markup.includes('data-autumn-motion'))
    }
    const frozen = renderToStaticMarkup(
      createElement(Cafe, { backgroundId: 'study-linen', thumbnail: true, paused: true }),
    )
    assert.ok(frozen.includes('data-static="true"') && frozen.includes('data-paused="true"'))
  } finally {
    await window.happyDOM.abort()
    await server.close()
  }
})

test('autumn leaf motion has complete finite endpoints and obeys pause/static/reduced controls', () => {
  const css = readFileSync(
    new URL('../src/pages/focus/ui/backgrounds.css', import.meta.url),
    'utf8',
  )
  const motion = css.slice(css.indexOf('@keyframes autumn-leaf-fall'))
  assert.match(motion, /0%\s*\{\s*transform:[^;]+;\s*opacity:\s*0;/)
  assert.match(motion, /100%\s*\{\s*transform:[^;]+;\s*opacity:\s*0;/)
  assert.ok(css.includes('transform-origin: center center'))
  assert.match(
    css,
    /data-paused="true"\] \.autumn-leaf-fall[^}]*animation-play-state:\s*paused !important/s,
  )
  assert.match(css, /data-static="true"\] \.autumn-leaf-fall[^}]*display:\s*none !important/s)
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.autumn-leaf-fall\s*\{\s*display:\s*none !important/s,
  )
})
