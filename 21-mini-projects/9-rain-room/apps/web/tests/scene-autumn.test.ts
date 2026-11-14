import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_BACKGROUNDS, BACKGROUND_CATEGORIES } from '../src/pages/focus/model/backgrounds.ts'
import { AUTUMN_SPACES, getAutumnSpace } from '../src/pages/focus/model/sceneAutumn.ts'
import { getSceneWeather } from '../src/pages/focus/model/sceneWeather.ts'

test('each of the six location groups has one or two distinct authored autumn rooms', () => {
  assert.equal(ALL_BACKGROUNDS.length, 68, 'seasonal renovation must not duplicate room identity')
  assert.equal(AUTUMN_SPACES.length, 8)
  assert.equal(new Set(AUTUMN_SPACES.map((space) => space.id)).size, AUTUMN_SPACES.length)
  assert.equal(new Set(AUTUMN_SPACES.map((space) => space.motif)).size, AUTUMN_SPACES.length)
  for (const category of BACKGROUND_CATEGORIES) {
    const rooms = AUTUMN_SPACES.filter((space) => space.category === category.id)
    assert.ok(rooms.length >= 1 && rooms.length <= 2, category.id)
  }
  for (const autumn of AUTUMN_SPACES) {
    const existing = ALL_BACKGROUNDS.find((room) => room.id === autumn.id)
    assert.ok(existing, autumn.id)
    assert.equal(autumn.category, existing.category)
    assert.equal(autumn.scene, existing.scene)
    assert.equal(getAutumnSpace(existing.id), getAutumnSpace(existing.scene))
    assert.equal(autumn.season, 'autumn')
    assert.ok(['rain', 'heavy-rain', 'storm'].includes(getSceneWeather(existing.id)), existing.id)
  }
  for (const unknown of ['__proto__', 'missing-room', '', -1, 999])
    assert.equal(getAutumnSpace(unknown), undefined)
  assert.equal(getAutumnSpace('premium-storm-lighthouse'), undefined)
  assert.equal(getSceneWeather('premium-storm-lighthouse'), 'thunderstorm')
  assert.equal(getSceneWeather('premium-sakura-teahouse'), 'sakura-rain')
})

test('autumn renovations expose matching localized descriptions and stay scoped to selected rooms', () => {
  const cues = { ko: /가을|단풍|은행|감나무/, en: /autumn|maple|ginkgo/i, zh: /秋|枫|银杏/ }
  for (const language of ['ko', 'en', 'zh'] as const) {
    const catalog = JSON.parse(
      readFileSync(
        new URL(`../src/shared/i18n/locales/${language}/catalog.json`, import.meta.url),
        'utf8',
      ),
    )
    for (const autumn of AUTUMN_SPACES) {
      const room = ALL_BACKGROUNDS.find((candidate) => candidate.id === autumn.id)!
      const translated = catalog.backgrounds[autumn.id]
      assert.match(
        translated.name + translated.description,
        cues[language],
        `${language}/${room.id}`,
      )
      assert.ok(translated.description.length > 15)
      if (language === 'ko') {
        assert.equal(translated.name, room.name)
        assert.equal(translated.description, room.description)
      } else {
        assert.doesNotMatch(translated.name + translated.description, /[가-힣]/)
      }
    }
  }
  for (const room of ALL_BACKGROUNDS) {
    if (!AUTUMN_SPACES.some((autumn) => autumn.id === room.id))
      assert.equal(getAutumnSpace(room.id), undefined, room.id)
  }
})
