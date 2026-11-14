import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DRINKS } from '../src/pages/focus/model/cafeRitual.ts'
import { DRINK_ARTWORK } from '../src/pages/focus/ui/ritual/drink-assets.ts'

test('native SVG drink palette catalog covers every menu ID with distinct authored shapes', () => {
  assert.deepEqual(Object.keys(DRINK_ARTWORK).sort(), DRINKS.map(({ id }) => id).sort())
  assert.equal(new Set(Object.values(DRINK_ARTWORK).map(({ shape }) => shape)).size, 10)
  for (const artwork of Object.values(DRINK_ARTWORK)) {
    for (const key of ['body', 'shade', 'liquid', 'cream'] as const)
      assert.match(artwork[key], /^#[0-9a-f]{6}$/i)
  }
})

test('active cup artwork has no raster/network assets or photo fallback', async () => {
  const source = await readFile(
    new URL('../src/pages/focus/ui/ritual/DrinkCup.tsx', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(source, /<img\b|<image\b|href=|src=|LegacyDrinkCup|useState|https?:/)
  assert.match(source, /viewBox="0 0 120 120"/)
  assert.match(source, /data-cup-shape/)
})
