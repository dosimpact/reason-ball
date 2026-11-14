import test from 'node:test'
import assert from 'node:assert/strict'
import { publishNativeLanguage } from '../src/shared/i18n/nativeLanguageBridge.ts'
test('native language bridge is optional and sends only supported language data', () => {
  assert.doesNotThrow(() => publishNativeLanguage('ko', undefined))
  assert.doesNotThrow(() => publishNativeLanguage('en', {}))
  const messages: string[] = []
  const target = {
    ReactNativeWebView: { postMessage: (message: string) => messages.push(message) },
  }
  for (const language of ['ko', 'en', 'zh', 'javascript:alert(1)', undefined])
    publishNativeLanguage(language, target)
  assert.deepEqual(
    messages.map((message) => JSON.parse(message)),
    ['ko', 'en', 'zh'].map((language) => ({ type: 'rain-room:language', language })),
  )
})
