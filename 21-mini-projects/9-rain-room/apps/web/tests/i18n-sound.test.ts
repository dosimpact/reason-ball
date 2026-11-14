import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../src/shared/i18n/locales/', import.meta.url)
function leaves(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === 'string'
        ? [[`${prefix}${key}`, item]]
        : Object.entries(leaves(item as Record<string, unknown>, `${prefix}${key}.`)),
    ),
  )
}
test('sound locales cover the same keys and preserve interpolation parameters', async () => {
  const translations = await Promise.all(
    ['ko', 'en', 'zh'].map(async (lang) =>
      leaves(JSON.parse(await readFile(new URL(`${lang}/sound.json`, root), 'utf8'))),
    ),
  )
  const expected = Object.keys(translations[0]).sort()
  assert.ok(expected.length > 50)
  const tokens = (value: string) =>
    [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort()
  for (const translation of translations) {
    assert.deepEqual(Object.keys(translation).sort(), expected)
    for (const key of expected) {
      assert.ok(translation[key].trim(), key)
      assert.deepEqual(tokens(translation[key]), tokens(translations[0][key]), key)
    }
  }
  for (const translation of translations.slice(1))
    for (const [key, text] of Object.entries(translation))
      assert.ok(!/[가-힣]/.test(text), `${key}: untranslated Korean`)
})

test('sound controls render translated visible labels and accessibility text in all languages', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { i18n } = await server.ssrLoadModule('/src/shared/i18n/index.ts')
    const { default: Mixer } = await server.ssrLoadModule('/src/pages/focus/ui/AmbientMixer.tsx')
    const { default: Controls } = await server.ssrLoadModule(
      '/src/pages/focus/ui/PlaybackControls.tsx',
    )
    const { MusicSettings } = await server.ssrLoadModule('/src/pages/focus/ui/SoundPanels.tsx')
    const { defaultAmbient } = await server.ssrLoadModule('/src/pages/focus/model/ambient.ts')
    const expected = {
      ko: {
        pause: '환경음 일시정지',
        rain: '빗소리',
        mode: '한곡반복',
        playlist: '플레이리스트 재생',
      },
      en: {
        pause: 'Pause ambient sounds',
        rain: 'Rain',
        mode: 'Repeat one',
        playlist: 'Play playlist',
      },
      zh: { pause: '暂停环境音', rain: '雨声', mode: '单曲循环', playlist: '播放歌单' },
    }
    for (const [lang, labels] of Object.entries(expected)) {
      await i18n.changeLanguage(lang)
      const mix = renderToStaticMarkup(
        createElement(Mixer, {
          mix: defaultAmbient(),
          onUpdate() {},
          playing: true,
          error: '',
          onToggle() {},
        }),
      )
      assert.ok(mix.includes(`aria-label="${labels.pause}"`), lang)
      assert.ok(mix.includes(labels.rain), lang)
      const controls = renderToStaticMarkup(
        createElement(Controls, { mode: 'repeat-one', onMode() {}, onNext() {} }),
      )
      assert.ok(controls.includes(labels.mode), lang)
      const music = renderToStaticMarkup(
        createElement(MusicSettings, {
          selectedId: 'afternoon-study',
          volume: 0.5,
          onVolume() {},
          error: '',
          queue: null,
          onShuffle() {},
          category: '',
        }),
      )
      assert.ok(music.includes(labels.playlist), lang)
      if (lang !== 'ko')
        assert.ok(!/[가-힣]/.test(music + mix + controls), `${lang}: Korean leaked into sound UI`)
      assert.ok(
        !/ambient\.|playback\.|musicCategories\./.test(mix + controls),
        `${lang}: untranslated keys`,
      )
    }
    await i18n.changeLanguage('ko')
  } finally {
    await server.close()
  }
})

test('library queue order survives language switches and legacy translated criteria', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { i18n } = await server.ssrLoadModule('/src/shared/i18n/index.ts')
    const { default: Library } = await server.ssrLoadModule('/src/pages/focus/ui/MusicLibrary.tsx')
    const { MUSIC_TRACKS } = await server.ssrLoadModule('/src/pages/focus/model/music.ts')
    const ids = MUSIC_TRACKS.filter(
      (track: { categoryId: string }) => track.categoryId === 'deep-work',
    )
      .slice(0, 2)
      .map((track: { id: string }) => track.id)
      .reverse()
    for (const language of ['ko', 'en', 'zh']) {
      await i18n.changeLanguage(language)
      for (const criteria of ['deep-work', '집중과 탐구']) {
        const html = renderToStaticMarkup(
          createElement(Library, {
            selectedId: ids[0],
            category: 'deep-work',
            onCategory() {},
            preferredStartId: ids[0],
            onPreferredStart() {},
            queue: { ids, index: 0, criteria },
          }),
        )
        assert.ok(html.includes('data-order="queue"'), `${language}/${criteria}: queue lost`)
        assert.ok(
          html.indexOf(`data-track-id="${ids[0]}"`) < html.indexOf(`data-track-id="${ids[1]}"`),
        )
        if (language !== 'ko') assert.ok(!/[가-힣]/.test(html), `${language}: Korean library text`)
      }
    }
    await i18n.changeLanguage('ko')
  } finally {
    await server.close()
  }
})
