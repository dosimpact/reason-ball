import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { getAnimalHabitat } from '../src/pages/focus/model/animalHabitats.ts'
import { extractAnimalSlots } from '../scripts/pixi-animal-slots.mjs'
test('all authored bodies become ordered slots without removing supports or humans', async () => {
  const dom = new Window(),
    server = await createServer({
      server: { middlewareMode: true, watch: null, hmr: false },
      appType: 'custom',
    })
  try {
    const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
    const { default: Premium } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumScene.tsx',
    )
    const { PremiumAtmosphereDrawing } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumAtmosphere.tsx',
    )
    let authored = 0,
      slots = 0
    for (const room of ALL_BACKGROUNDS) {
      const plan = getAnimalHabitat(room.id),
        premium = room.id.startsWith('premium-')
      for (const coffeeCount of ['premium-personal-roastery', 'premium-memory-house'].includes(
        room.id,
      )
        ? [0, 25]
        : [0]) {
        const markup = ['rear', 'foreground'].map((layer) =>
          renderToStaticMarkup(
            createElement(
              premium ? Premium : Cafe,
              premium
                ? { spaceId: room.id, layer, static: true, coffeeCount }
                : { backgroundId: room.id, layer, artOnly: true, paused: true },
            ),
          ),
        )
        if (premium)
          markup.push(
            renderToStaticMarkup(
              createElement(
                'svg',
                null,
                createElement(PremiumAtmosphereDrawing, { spaceId: room.id, static: true }),
              ),
            ),
          )
        const found: string[] = []
        for (const source of markup) {
          const holder = dom.document.createElement('div')
          holder.innerHTML = source
          const tree = holder.querySelector('svg')!
          const humans = tree.querySelectorAll('[data-character],[data-premium-character]').length
          const inserted = extractAnimalSlots(tree, plan)
          found.push(...inserted)
          assert.equal(
            tree.querySelectorAll('[data-character],[data-premium-character]').length,
            humans,
            `${room.id}: people remain intact`,
          )
          for (const actor of plan.actors.filter((a) => a.source))
            assert.equal(
              tree.querySelectorAll(actor.source!.selector).length,
              0,
              `${room.id}/${actor.id}: no baked body`,
            )
          if (room.id === 'cafe-rain' && inserted.length)
            assert.ok(tree.querySelector('[data-animal-static-support]'))
          for (const actor of plan.actors.filter((a) => a.slotOf))
            assert.equal(
              tree.querySelector(`[data-premium-motion="${actor.slotOf}"]`),
              null,
              'no old dragon chest',
            )
        }
        assert.deepEqual(
          found.sort(),
          plan.actors.map((a) => a.id).sort(),
          `${room.id}/coffee${coffeeCount}`,
        )
        if (coffeeCount === 0) {
          authored += plan.actors.filter((a) => a.source).length
          slots += found.length
        }
      }
    }
    assert.ok(authored >= 83)
    assert.ok(slots > authored)
  } finally {
    await server.close()
    await dom.happyDOM.abort()
  }
})

test('identical high masks in different filename roles each publish their referenced local file', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { default: sharp } = await import('sharp')
  const { writeCachedPng } = await import('../scripts/pixi-export-assets.mjs')
  const directory = await mkdtemp(join(tmpdir(), 'pixi-mask-cache-'))
  try {
    const mask = await sharp({
      create: { width: 3, height: 3, channels: 4, background: '#ffffff' },
    })
      .png()
      .toBuffer()
    const cache = new Set(['same-content-hash'])
    for (const filename of [
      'clip-high-same-content-hash.png',
      'animal-clip-high-same-content-hash.png',
      'clip-same-content-hash.png',
      'same-content-hash.png',
    ]) {
      await writeCachedPng(directory, filename, mask, cache)
      assert.deepEqual(
        await readFile(join(directory, filename)),
        mask,
        `${filename}: the referenced URL must exist even with identical content`,
      )
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
