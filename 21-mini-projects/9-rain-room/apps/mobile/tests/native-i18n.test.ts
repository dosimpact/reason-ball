import test from 'node:test'
import { URL as NodeURL } from 'node:url'
import assert from 'node:assert/strict'
import {
  deviceLanguage,
  parseNativeLanguage,
  nativeI18n,
  configurationKey,
} from '../src/native-i18n'
test('device language supports Korean, English, Chinese and an English fallback', () => {
  assert.equal(deviceLanguage('ko-KR'), 'ko')
  assert.equal(deviceLanguage('zh-Hant-TW'), 'zh')
  assert.equal(deviceLanguage('en-US'), 'en')
  assert.equal(deviceLanguage('fr-FR'), 'en')
})
test('native language messages require supported codes and the configured web origin', () => {
  const web = 'https://rain.example/'
  const data = JSON.stringify({ type: 'rain-room:language', language: 'zh' })
  assert.equal(parseNativeLanguage(data, web + 'room', web), 'zh')
  for (const source of [
    'https://other.example/',
    'file:///foo',
    'null',
    'https://rain.example.evil/',
  ])
    assert.equal(parseNativeLanguage(data, source, web), null)
  for (const invalid of [
    'bad JSON',
    '{}',
    'null',
    JSON.stringify({ type: 'rain-room:language', language: 'fr' }),
    JSON.stringify({ type: 'other', language: 'ko' }),
  ])
    assert.equal(parseNativeLanguage(invalid, web, web), null)
})
test('all native recovery states have localized copy without Korean fallback', () => {
  const keys = Object.keys(nativeI18n.getResourceBundle('en', 'translation'))
  for (const language of ['ko', 'en', 'zh']) {
    assert.deepEqual(Object.keys(nativeI18n.getResourceBundle(language, 'translation')), keys)
    const t = nativeI18n.getFixedT(language)
    for (const key of keys) {
      const copy = t(key, { status: 503 })
      assert.ok(copy.length && copy !== key)
      if (language !== 'ko') assert.ok(!/[가-힣]/.test(copy))
    }
    assert.ok(t('http', { status: 503 }).includes('503'))
  }
  assert.equal(
    configurationKey(new Error('EXPO_PUBLIC_WEB_URL must be set')),
    'configurationMissing',
  )
  assert.equal(configurationKey(new Error('The web URL must use HTTPS')), 'configurationHttps')
  assert.equal(
    configurationKey(new Error('The web URL must not contain credentials')),
    'configurationCredentials',
  )
  assert.equal(configurationKey(new Error('bad')), 'configurationInvalid')
})

// Android history updates are TopLoadingStart events even when the document is already loaded.
test('native history updates and external-link failures preserve the live visit', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new NodeURL('../src/App.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes('onLoadStart={({ nativeEvent }) => setLoading(nativeEvent.loading)}'))
  assert.ok(source.includes('Linking.openURL(url).catch(() => setExternalNotice(true))'))
  assert.ok(!source.includes('!externalNotice &&'))
})
