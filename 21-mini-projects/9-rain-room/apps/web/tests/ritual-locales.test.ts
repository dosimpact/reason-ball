import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DRINKS } from '../src/pages/focus/model/cafeRitual.ts'

test('all ritual languages cover the same UI, ten drinks, and interpolation variables', async () => {
  const flat = (object: Record<string, unknown>, prefix = ''): Record<string, string> =>
    Object.fromEntries(
      Object.entries(object).flatMap(([key, value]) =>
        typeof value === 'string'
          ? [[prefix + key, value]]
          : Object.entries(flat(value as Record<string, unknown>, prefix + key + '.')),
      ),
    )
  const resources = await Promise.all(
    ['ko', 'en', 'zh'].map(async (language) =>
      JSON.parse(
        await readFile(
          new URL(`../src/shared/i18n/locales/${language}/ritual.json`, import.meta.url),
          'utf8',
        ),
      ),
    ),
  )
  const base = flat(resources[0])
  for (const resource of resources) {
    const translated = flat(resource)
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(base).sort())
    for (const [key, value] of Object.entries(translated)) {
      assert.ok(value.trim(), key)
      assert.deepEqual(
        (value.match(/{{\w+}}/g) || []).sort(),
        (base[key].match(/{{\w+}}/g) || []).sort(),
        key,
      )
    }
    for (const drink of DRINKS) assert.ok(resource.drinks[drink.id], drink.id)
  }
  for (const resource of resources.slice(1))
    assert.ok(
      !/[가-힣]/.test(JSON.stringify(resource)),
      'English and Chinese cannot leak Korean fallback strings',
    )
})
