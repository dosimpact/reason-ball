import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { sceneAssetUrl } from '../src/pages/focus/lib/sceneAsset.ts'
import { checkAmbience } from '../scripts/export-scene-ambience.ts'

const app = new URL('../', import.meta.url)
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
test('all room ambience assets are tiny WebP derivatives of the current thumbnails', async () => {
  const catalog = await checkAmbience()
  assert.deepEqual(
    catalog.entries.map((entry) => entry.id).sort(),
    ALL_BACKGROUNDS.map((room) => room.id).sort(),
  )
  assert.equal(catalog.entries.length, 68)
  assert.deepEqual(catalog.recipe, {
    width: 64,
    height: 66,
    blur: 4,
    brightness: 0.4,
    saturation: 0.75,
    quality: 55,
  })
  let bytes = 0
  for (const entry of catalog.entries) {
    const [source, output] = await Promise.all([
      readFile(new URL(`public${entry.source}`, app)),
      readFile(new URL(`public${entry.path}`, app)),
    ])
    assert.equal(hash(source), entry.sourceSha256, `${entry.id}: source freshness`)
    assert.equal(hash(output), entry.sha256, `${entry.id}: output integrity`)
    assert.equal(output.length, entry.bytes)
    const meta = await sharp(output).metadata()
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 64, 66])
    bytes += output.length
  }
  assert.ok(bytes < 128 * 1024, `all rooms must share a small decoded/download budget: ${bytes}`)
})
test('ambience URLs preserve stable IDs and reject unsafe paths without changing rear/thumbnail URLs', () => {
  for (const room of ALL_BACKGROUNDS) {
    assert.equal(sceneAssetUrl(room.id, 'ambience'), `/backgrounds/ambience/${room.id}.webp`)
    assert.equal(sceneAssetUrl(room.id, 'thumbnail'), `/backgrounds/thumbnail/${room.id}.webp`)
    for (const tier of ['normal', 'fullscreen'] as const)
      assert.equal(sceneAssetUrl(room.id, tier), `/backgrounds/rear/${tier}/${room.id}.png`)
  }
  for (const id of ['../secret', 'https://example.com/a', 'cafe-rain?x=1', ''])
    assert.equal(sceneAssetUrl(id, 'ambience'), '/backgrounds/ambience/cafe-rain.webp')
})
