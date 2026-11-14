import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AMBIENT_SOUNDS,
  defaultAmbient,
  sanitizeAmbient,
} from '../src/pages/focus/model/ambient.ts'
import { sanitizeSettings } from '../src/pages/focus/model/timer.ts'

test('all ten recorded ambient sources have independent bounded volume and selection', () => {
  assert.equal(AMBIENT_SOUNDS.length, 10)
  assert.equal(new Set(AMBIENT_SOUNDS.map((s) => s.id)).size, 10)
  const mix = sanitizeAmbient({
    rain: { enabled: false, volume: -2 },
    crickets: { enabled: true, volume: 7 },
    cafe: { enabled: true, volume: 0.23 },
    birds: { enabled: false, volume: NaN },
    unknown: { enabled: true, volume: 1 },
  })
  assert.deepEqual(mix.rain, { enabled: false, volume: 0 })
  assert.deepEqual(mix.crickets, { enabled: true, volume: 1 })
  assert.deepEqual(mix.cafe, { enabled: true, volume: 0.23 })
  assert.deepEqual(mix.birds, { enabled: false, volume: 0.4 })
  assert.equal(Object.keys(mix).length, 10)
  const original = mix.cafe.volume
  mix.rain.volume = 0.99
  assert.equal(mix.cafe.volume, original)
})
test('legacy rain migrates, malformed settings reset safely, no shared mutable defaults', () => {
  assert.deepEqual(sanitizeSettings({ rain: 0.72 }).ambient.rain, { enabled: true, volume: 0.72 })
  assert.equal(sanitizeSettings({ rain: Infinity }).ambient.rain.volume, 0.35)
  assert.equal(sanitizeSettings(null).background, 'cafe-rain')
  assert.equal(sanitizeSettings({ background: 'not-real' }).background, 'cafe-rain')
  assert.deepEqual(sanitizeAmbient('broken'), defaultAmbient())
  const first = defaultAmbient()
  first.rain.enabled = false
  assert.equal(defaultAmbient().rain.enabled, true)
})
test('all sound selections and levels survive a settings serialization round trip', () => {
  const ambient = Object.fromEntries(
    AMBIENT_SOUNDS.map((s, i) => [s.id, { enabled: i % 2 === 0, volume: i / 10 }]),
  )
  const settings = sanitizeSettings({ ambient })
  assert.deepEqual(sanitizeSettings(JSON.parse(JSON.stringify(settings))), settings)
})

test('every ambient sound ships a local recording with per-file licensing and integrity metadata', async () => {
  const { readFile, stat } = await import('node:fs/promises')
  const { createHash } = await import('node:crypto')
  const folder = new URL('../public/audio/', import.meta.url)
  const records = JSON.parse(await readFile(new URL('recordings.json', folder), 'utf8'))
  const credits = await readFile(new URL('credits.txt', folder), 'utf8')
  for (const sound of AMBIENT_SOUNDS) {
    assert.ok(sound.url.startsWith('/audio/') && sound.url.endsWith('.mp3'))
    assert.ok(!sound.source.includes('합성'))
    const record = records.find((item: { id: string }) => item.id === sound.id)
    assert.ok(record, sound.id)
    assert.ok(['CC0 1.0', 'CC BY 4.0', 'CC BY 3.0', 'Public Domain'].includes(record.license))
    assert.ok(record.durationSeconds > 5 && record.durationSeconds <= 50)
    assert.ok(record.author && record.source.startsWith('https://'))
    assert.ok(credits.includes(record.author) && credits.includes(record.source))
    const file = new URL(record.file, folder)
    assert.ok((await stat(file)).size < 2_000_000)
    assert.equal(
      createHash('sha256')
        .update(await readFile(file))
        .digest('hex'),
      record.sha256,
    )
  }
})
