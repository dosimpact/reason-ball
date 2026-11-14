import koCollection from './locales/ko/collection.json'
import enCollection from './locales/en/collection.json'
import zhCollection from './locales/zh/collection.json'
import { createInstance } from 'i18next'
import { publishNativeLanguage } from './nativeLanguageBridge'
import { initReactI18next } from 'react-i18next'
import koRitual from './locales/ko/ritual.json'
import enRitual from './locales/en/ritual.json'
import zhRitual from './locales/zh/ritual.json'
import koCommon from './locales/ko/common.json'
import enCommon from './locales/en/common.json'
import zhCommon from './locales/zh/common.json'
import koSound from './locales/ko/sound.json'
import enSound from './locales/en/sound.json'
import zhSound from './locales/zh/sound.json'
import koCatalog from './locales/ko/catalog.json'
import enCatalog from './locales/en/catalog.json'
import zhCatalog from './locales/zh/catalog.json'
import koExtras from './locales/ko/extras.json'
import enExtras from './locales/en/extras.json'
import zhExtras from './locales/zh/extras.json'
import {
  initialLanguage,
  persistLanguage,
  normalizeLanguage,
  LANGUAGE_STORAGE_KEY,
  type AppLanguage,
} from './language'
export { useTranslation } from 'react-i18next'
export {
  APP_LANGUAGES,
  normalizeLanguage,
  detectLanguage,
  LANGUAGE_STORAGE_KEY,
  type AppLanguage,
} from './language'
function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
const browser = typeof window !== 'undefined'
export const i18n = createInstance()
void i18n.use(initReactI18next).init({
  resources: {
    ko: {
      common: koCommon,
      sound: koSound,
      catalog: koCatalog,
      extras: koExtras,
      ritual: koRitual,
      collection: koCollection,
    },
    en: {
      common: enCommon,
      sound: enSound,
      catalog: enCatalog,
      extras: enExtras,
      ritual: enRitual,
      collection: enCollection,
    },
    zh: {
      common: zhCommon,
      sound: zhSound,
      catalog: zhCatalog,
      extras: zhExtras,
      ritual: zhRitual,
      collection: zhCollection,
    },
  },
  lng: initialLanguage(
    browserStorage(),
    browser ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [],
    browser,
  ),
  fallbackLng: 'en',
  supportedLngs: ['ko', 'en', 'zh'],
  defaultNS: 'common',
  ns: ['common', 'sound', 'catalog', 'extras', 'ritual', 'collection'],
  interpolation: { escapeValue: false },
  initAsync: false,
  react: { useSuspense: false },
  returnNull: false,
})
export async function setAppLanguage(language: AppLanguage) {
  const saved = persistLanguage(browserStorage(), language)
  await i18n.changeLanguage(language)
  return saved
}
function applyDocumentLanguage() {
  publishNativeLanguage(i18n.resolvedLanguage)
  if (typeof document === 'undefined') return
  document.documentElement.lang =
    i18n.resolvedLanguage === 'zh' ? 'zh-Hans' : (i18n.resolvedLanguage ?? 'en')
  document.title = i18n.t('app.title')
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', i18n.t('app.description'))
}
i18n.on('languageChanged', applyDocumentLanguage)
applyDocumentLanguage()

if (browser) {
  window.addEventListener('storage', (event) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      const next =
        normalizeLanguage(event.newValue) ??
        initialLanguage(null, navigator.languages ?? [navigator.language])
      void i18n.changeLanguage(next)
    }
  })
  window.addEventListener('languagechange', () => {
    let manual: AppLanguage | null = null
    try {
      manual = normalizeLanguage(browserStorage()?.getItem(LANGUAGE_STORAGE_KEY))
    } catch {}
    if (!manual)
      void i18n.changeLanguage(initialLanguage(null, navigator.languages ?? [navigator.language]))
  })
}
