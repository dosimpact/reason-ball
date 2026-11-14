import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'

test('all rear PNG authoring layers exclude living cast, room plants, furniture and fixtures while the foreground retains their SVG geometry', async () => {
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const window = new Window()
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    const selectors = [
      '.scene-firefly',
      '[data-vector-outdoor]',
      '[data-pose]',
      '[data-animal-habitat]',
      '[data-plant-species]',
      '[data-table-shape]',
      '[data-furnishing]',
      '[data-scene-furniture]',
      '[data-room-lighting]',
      '[data-scene-fixture]',
      '[data-special-prop]:not([data-special-prop="dome-ribs"])',
    ]
    for (const room of BACKGROUNDS) {
      const read = (layer: string) => {
        window.document.body.innerHTML = renderToStaticMarkup(
          createElement(Cafe, { backgroundId: room.id, layer, artOnly: true }),
        )
        return window.document.body.cloneNode(true) as HTMLElement
      }
      const all = read('all'),
        rear = read('rear'),
        foreground = read('foreground')
      for (const selector of selectors) {
        assert.equal(rear.querySelectorAll(selector).length, 0, `${room.id} rear ${selector}`)
        assert.equal(
          foreground.querySelectorAll(selector).length,
          all.querySelectorAll(selector).length,
          `${room.id} foreground ${selector}`,
        )
      }
      assert.ok(rear.querySelector('[data-scene-layer="rear"]'))
      assert.equal(foreground.querySelector('[data-scene-layer="rear"]'), null)
      assert.ok(foreground.querySelectorAll('path').length > 10, room.id)
      assert.equal(foreground.querySelector('[data-testid="rain-overlay"]'), null)
    }
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})
