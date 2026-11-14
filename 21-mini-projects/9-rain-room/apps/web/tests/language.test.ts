import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeLanguage,
  detectLanguage,
  initialLanguage,
  persistLanguage,
  LANGUAGE_STORAGE_KEY,
} from '../src/shared/i18n/language.ts'
test('language normalization and ordered browser preferences choose supported ko/zh/en', () => {
  for (const [input, expected] of [
    ['ko-KR', 'ko'],
    ['zh-CN', 'zh'],
    ['zh-TW', 'zh'],
    ['zh-Hant-TW', 'zh'],
    ['en-US', 'en'],
    ['en_GB', 'en'],
  ])
    assert.equal(normalizeLanguage(input), expected)
  assert.equal(normalizeLanguage('fr-FR'), null)
  assert.equal(normalizeLanguage(null), null)
  assert.equal(detectLanguage(['fr-FR', 'zh-TW', 'en-US']), 'zh')
  assert.equal(detectLanguage(['ko-KR', 'en-US']), 'ko')
  assert.equal(detectLanguage(['fr', 'de']), 'en')
  assert.equal(detectLanguage([]), 'en')
})
test('manual override persists independently, wins browser preferences and safely ignores invalid/blocked storage', () => {
  let raw: string | null = null
  const storage = {
    getItem: (key: string) => (key === LANGUAGE_STORAGE_KEY ? raw : null),
    setItem: (key: string, value: string) => {
      assert.equal(key, LANGUAGE_STORAGE_KEY)
      raw = value
    },
  }
  assert.equal(initialLanguage(storage, ['en-US']), 'en')
  assert.equal(persistLanguage(storage, 'zh'), true)
  assert.equal(initialLanguage(storage, ['ko-KR']), 'zh')
  raw = 'invalid'
  assert.equal(initialLanguage(storage, ['ko-KR']), 'ko')
  const blocked = {
    getItem() {
      throw Error('blocked')
    },
    setItem() {
      throw Error('blocked')
    },
  }
  assert.equal(initialLanguage(blocked, ['zh-CN']), 'zh')
  assert.equal(persistLanguage(blocked, 'en'), false)
  assert.equal(
    initialLanguage(storage, ['en-US'], false),
    'ko',
    'SSR references remain deterministic Korean',
  )
})

test('common locale dictionaries cover identical nonempty keys and preserve interpolation variables', async () => {
  const { readFileSync } = await import('node:fs')
  const flat = (value: Record<string, unknown>, prefix = ''): Map<string, string> => {
    const out = new Map<string, string>()
    for (const [key, item] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (typeof item === 'string') out.set(path, item)
      else for (const [k, v] of flat(item as Record<string, unknown>, path)) out.set(k, v)
    }
    return out
  }
  const locales = ['ko', 'en', 'zh'].map((lang) =>
    flat(
      JSON.parse(
        readFileSync(
          new URL(`../src/shared/i18n/locales/${lang}/common.json`, import.meta.url),
          'utf8',
        ),
      ),
    ),
  )
  for (const locale of locales) {
    assert.deepEqual([...locale.keys()].sort(), [...locales[0]!.keys()].sort())
    for (const [key, text] of locale) {
      assert.ok(text.trim(), key)
      assert.deepEqual(
        (text.match(/{{\w+}}/g) || []).sort(),
        (locales[0]!.get(key)!.match(/{{\w+}}/g) || []).sort(),
        key,
      )
    }
  }
})
