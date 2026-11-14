import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { sceneAssetUrl } from '../src/pages/focus/lib/sceneAsset.ts'
test('every room ships correctly sized thumbnail, normal and fullscreen assets', async () => {
  for (const room of ALL_BACKGROUNDS)
    for (const [resolution, width, height] of [
      ['thumbnail', 320, 328],
      ['normal', 800, 820],
      ['fullscreen', 1200, 1230],
    ] as const) {
      const metadata = await sharp(`public${sceneAssetUrl(room.id, resolution)}`).metadata()
      assert.equal(metadata.format, resolution === 'thumbnail' ? 'webp' : 'png')
      assert.equal(metadata.width, width, `${room.id}/${resolution}`)
      assert.equal(metadata.height, height)
    }
  assert.equal(sceneAssetUrl('../bad', 'normal'), '/backgrounds/rear/normal/cafe-rain.png')
})
