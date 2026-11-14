import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Window } from 'happy-dom'
import sharp from 'sharp'

test('cinema film SSR has unique fixed apertures and moving pixels remain inside the screen', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const window = new Window()
  try {
    const { default: Film } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/CinemaFilm.tsx',
    )
    window.document.body.innerHTML = renderToStaticMarkup(
      createElement('svg', null, createElement(Film), createElement(Film)),
    )
    const films = window.document.querySelectorAll('[data-cinema-film]')
    const ids = [...window.document.querySelectorAll('clipPath')].map((node) => node.id)
    assert.equal(new Set(ids).size, 2)
    const film = films[0]!
    assert.ok(!film.querySelector('image, filter, text, foreignObject, animate'))
    const aperture = film.querySelector('g[clip-path]')!
    assert.equal(film.querySelector('clipPath path')!.getAttribute('d'), 'M470 260h260v190H470z')
    for (const node of film.querySelectorAll('[class]')) assert.ok(aperture.contains(node))
    const render = async (x: number) => {
      // Software rasterization of the authored SVG at native runtime's translate poses.
      film.querySelector('.cinema-film-train')!.setAttribute('transform', `translate(${x} 0)`)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820">${film.outerHTML}</svg>`
      return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()
    }
    const first = await render(0)
    const midpoint = await render(220)
    const last = await render(440)
    assert.deepEqual(first, last, 'offscreen train resets without a visible seam')
    let changed = 0
    for (let y = 0; y < 820; y++) {
      for (let x = 0; x < 800; x++) {
        const i = (y * 800 + x) * 4
        if (x < 470 || x >= 730 || y < 260 || y >= 450) {
          assert.equal(midpoint[i + 3], 0, `film escaped at ${x},${y}`)
        }
        if (first[i] !== midpoint[i] || first[i + 1] !== midpoint[i + 1]) changed++
      }
    }
    assert.ok(changed > 800, 'passing train must visibly change the actual film pixels')
  } finally {
    await window.happyDOM.abort()
    await server.close()
  }
})

test('film CSS defines native-compatible motion and pause/static/reduced contracts', () => {
  const css = readFileSync(
    new URL('../src/pages/focus/ui/premium/premium.css', import.meta.url),
    'utf8',
  )
  for (const name of ['train', 'cloud', 'water', 'shimmer']) {
    assert.match(css, new RegExp(`animation: cinema-film-${name} [\\d.]+s`))
    assert.match(css, new RegExp(`@keyframes cinema-film-${name}`))
  }
  assert.match(css, /data-paused="true"\][\s\S]*?animation-play-state: paused !important/)
  assert.match(css, /data-static="true"\][\s\S]*?animation-play-state: paused !important/)
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\[data-cinema-film\] \*\s*\{\s*animation: none !important/,
  )
  assert.match(css, /transform: translateX\(440px\)/)
})
