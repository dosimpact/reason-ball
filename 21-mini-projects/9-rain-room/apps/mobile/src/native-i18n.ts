import { createInstance } from 'i18next'
import ko from './locales/ko.json'
import en from './locales/en.json'
import zh from './locales/zh.json'

export type NativeLanguage = 'ko' | 'en' | 'zh'
export function deviceLanguage(
  locale = Intl.DateTimeFormat().resolvedOptions().locale,
): NativeLanguage {
  const base = locale.toLowerCase().split(/[-_]/)[0]
  return base === 'ko' || base === 'zh' ? base : 'en'
}
export function parseNativeLanguage(
  data: string,
  sourceUrl: string,
  webUrl: string,
): NativeLanguage | null {
  try {
    const source = new URL(sourceUrl)
    if (!['https:', 'http:'].includes(source.protocol) || source.origin !== new URL(webUrl).origin)
      return null
    const message: unknown = JSON.parse(data)
    if (!message || typeof message !== 'object') return null
    const { type, language } = message as { type?: unknown; language?: unknown }
    return type === 'rain-room:language' &&
      (language === 'ko' || language === 'en' || language === 'zh')
      ? language
      : null
  } catch {
    return null
  }
}
export const nativeI18n = createInstance()
void nativeI18n.init({
  resources: { ko: { translation: ko }, en: { translation: en }, zh: { translation: zh } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
})
export function configurationKey(reason: unknown): keyof typeof en {
  const message = reason instanceof Error ? reason.message : ''
  if (message.includes('must be set')) return 'configurationMissing'
  if (message.includes('credentials')) return 'configurationCredentials'
  if (message.includes('must use HTTPS')) return 'configurationHttps'
  return 'configurationInvalid'
}
