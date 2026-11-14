import test from 'node:test'
import assert from 'node:assert/strict'
import { PREMIUM_SPACES } from '../src/pages/focus/model/premiumSpaces.ts'
import { getPremiumExperience } from '../src/pages/focus/model/premiumExperience.ts'

test('premium rear assets exclude living and indoor SVG layers; reward collections stay bounded', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Scene } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumScene.tsx',
    )
    const render = (spaceId: string, layer: string, coffeeCount = 0) =>
      renderToStaticMarkup(createElement(Scene, { spaceId, layer, coffeeCount }))
    for (const room of PREMIUM_SPACES) {
      const rear = render(room.id, 'rear')
      assert.doesNotMatch(
        rear,
        /data-premium-(?:person|animal|object)=|premium-fish|premium-bat/,
        room.id,
      )
      assert.doesNotMatch(rear, /data-premium-layer="foreground"/, room.id)
      assert.doesNotMatch(rear, /data-premium-motion=/, room.id)
      const foreground = render(room.id, 'foreground')
      assert.match(foreground, /data-premium-object=/, room.id)
      assert.doesNotMatch(foreground, /data-premium-layer="rear"/, room.id)
      const full = render(room.id, 'all')
      for (const motion of getPremiumExperience(room.id)) {
        const marker = `data-premium-motion="${motion.id}"`
        assert.equal(foreground.split(marker).length - 1, 1, `${room.id}: live ${motion.id}`)
        assert.equal(full.split(marker).length - 1, 1, `${room.id}: fallback ${motion.id}`)
      }
      assert.equal(
        (foreground.match(/data-premium-person=/g) ?? []).length,
        room.companions,
        `${room.id} catalog matches its visible companions`,
      )
    }
    for (const id of ['premium-personal-roastery', 'premium-memory-house']) {
      const initial = render(id, 'foreground')
      const collected = render(id, 'foreground', 25)
      assert.ok(collected.length > initial.length, `${id} adds collected objects`)
      assert.equal(render(id, 'foreground', 100_000), collected, `${id} caps visual growth`)
      assert.equal(render(id, 'rear', 25), render(id, 'rear'), `${id} never bakes rewards into PNG`)
    }
  } finally {
    await server.close()
  }
})
